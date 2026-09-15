import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type DeliveredJob = { id: string; data: JsonValue };

type WorkHandler = (jobs: DeliveredJob[]) => Promise<void>;

type Schedule = { queueName: string; cron: string; data: JsonValue };

const boss = vi.hoisted(() => {
  const workers = new Map<string, WorkHandler>();
  const scheduled: Schedule[] = [];
  const queued: { kind: string; id: string; libraryId: string }[] = [];
  const dropped: string[] = [];
  const sent: { kind: string; options: { startAfter?: number; singletonKey?: string } }[] = [];

  return { workers, scheduled, queued, dropped, sent };
});

vi.mock('pg-boss', () => ({
  PgBoss: class {
    on() {}

    start() {
      return Promise.resolve();
    }

    createQueue() {
      return Promise.resolve();
    }

    work(kind: string, handler: WorkHandler) {
      boss.workers.set(kind, handler);

      return Promise.resolve('worker');
    }

    schedule(queueName: string, cron: string, data: JsonValue) {
      boss.scheduled.push({ queueName, cron, data });

      return Promise.resolve();
    }

    send(kind: string, _data: JsonValue, options: { startAfter?: number; singletonKey?: string }) {
      boss.sent.push({ kind, options });

      return Promise.resolve('job');
    }

    findJobs(kind: string, options: { data?: { libraryId?: string } }) {
      return Promise.resolve(
        boss.queued
          .filter((job) => job.kind === kind && job.libraryId === options.data?.libraryId)
          .map((job) => ({ id: job.id })),
      );
    }

    cancel(kind: string, id: string) {
      boss.dropped.push(`${kind}:${id}`);

      return Promise.resolve();
    }

    stop() {
      return Promise.resolve();
    }
  },
}));

const { createJobQueue } = await import('./createJobQueue');

const CHECK_DISK = 'server.checkDiskSpace';

const deliver = async (kind: string, jobs: DeliveredJob[]): Promise<void> => {
  const worker = boss.workers.get(kind);

  if (worker === undefined) {
    throw new Error(`nothing is working ${kind}`);
  }

  await worker(jobs);
};

beforeEach(() => {
  boss.workers.clear();
  boss.scheduled.length = 0;
  boss.queued.length = 0;
  boss.dropped.length = 0;
  boss.sent.length = 0;
});

describe('createJobQueue', () => {
  it('runs a job that carries no data at all, which is every job on a clock', async () => {
    const handler = vi.fn(() => Promise.resolve());

    await (
      await createJobQueue({
        connectionString: 'postgres://flux',
        handlers: { [CHECK_DISK]: handler },
      })
    ).startWorking();

    await deliver(CHECK_DISK, [{ id: 'job-1', data: null }]);

    expect(handler).toHaveBeenCalledWith('job-1', {});
  });

  it('reports a job that carried nothing as finished rather than as failed', async () => {
    const onFinished = vi.fn();

    await (
      await createJobQueue({
        connectionString: 'postgres://flux',
        handlers: { [CHECK_DISK]: () => Promise.resolve() },
        onFinished,
      })
    ).startWorking();

    await deliver(CHECK_DISK, [{ id: 'job-1', data: null }]);

    expect(onFinished).toHaveBeenCalledWith({
      kind: CHECK_DISK,
      jobId: 'job-1',
      subject: null,
      reason: null,
    });
  });

  it('still says what a job is about where its payload names something', async () => {
    const onFinished = vi.fn();
    const handler = vi.fn(() => Promise.resolve());

    await (
      await createJobQueue({
        connectionString: 'postgres://flux',
        handlers: { 'library.scan': handler },
        onFinished,
      })
    ).startWorking();

    await deliver('library.scan', [{ id: 'job-2', data: { libraryId: 'films', force: true } }]);

    expect(handler).toHaveBeenCalledWith('job-2', { libraryId: 'films', force: true });
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-2', subject: 'films' }),
    );
  });

  it('hands the failure on where the handler is what failed', async () => {
    const onFinished = vi.fn();

    await (
      await createJobQueue({
        connectionString: 'postgres://flux',
        handlers: { [CHECK_DISK]: () => Promise.reject(new Error('the disk is gone')) },
        onFinished,
      })
    ).startWorking();

    await expect(deliver(CHECK_DISK, [{ id: 'job-3', data: null }])).rejects.toThrow(
      'the disk is gone',
    );
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-3', reason: 'the disk is gone' }),
    );
  });

  it('runs nothing until it is told to start, so a handler cannot fire mid-assembly', async () => {
    const handler = vi.fn(() => Promise.resolve());

    await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: { [CHECK_DISK]: handler },
    });

    expect(boss.workers.size).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('schedules with the same shape of payload the startup path sends', async () => {
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: { [CHECK_DISK]: () => Promise.resolve() },
    });

    await queue.setSchedule(CHECK_DISK, 'default', '*/15 * * * *', 'Europe/London');

    expect(boss.scheduled).toEqual([{ queueName: CHECK_DISK, cron: '*/15 * * * *', data: {} }]);
  });

  it('stops what a library has running, and drops what it has waiting', async () => {
    let finish: () => void = () => {};
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: {
        'library.scan': () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      },
    });

    await queue.startWorking();

    const running = deliver('library.scan', [{ id: 'job-running', data: { libraryId: 'films' } }]);

    boss.queued.push(
      { kind: 'library.scan', id: 'job-waiting', libraryId: 'films' },
      { kind: 'library.scan', id: 'job-elsewhere', libraryId: 'shows' },
    );

    await expect(queue.cancelFor('films')).resolves.toBe(2);
    expect(queue.isCancelled('job-running')).toBe(true);
    expect(boss.dropped).toEqual(['library.scan:job-waiting']);

    finish();
    await running;
  });

  it('names the job already holding a key, rather than leaving a caller to invent one', async () => {
    let finish: () => void = () => {};
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: {
        'library.scan': () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      },
    });

    await queue.startWorking();

    const running = deliver('library.scan', [{ id: 'job-running', data: { libraryId: 'films' } }]);

    await expect(queue.liveJob('library.scan', 'films')).resolves.toBe('job-running');
    await expect(queue.liveJob('library.scan', 'shows')).resolves.toBeNull();

    finish();
    await running;
  });

  it('finds one that is only waiting, which is a collision just the same', async () => {
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: { 'library.scan': () => Promise.resolve() },
    });

    boss.queued.push({ kind: 'library.scan', id: 'job-waiting', libraryId: 'films' });

    await expect(queue.liveJob('library.scan', 'films')).resolves.toBe('job-waiting');
  });

  it('finds a job of a kind that is about no library at all', async () => {
    let finish: () => void = () => {};
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: {
        [CHECK_DISK]: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      },
    });

    await queue.startWorking();

    const running = deliver(CHECK_DISK, [{ id: 'job-housekeeping', data: {} }]);

    await expect(queue.liveJob(CHECK_DISK)).resolves.toBe('job-housekeeping');

    finish();
    await running;
  });

  it('still stops every kind a library has going, not just one of them', async () => {
    let finish: () => void = () => {};
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: {
        'library.scan': () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        'library.regenerateTrickplay': () => new Promise<void>(() => {}),
      },
    });

    await queue.startWorking();

    const scanning = deliver('library.scan', [{ id: 'job-scan', data: { libraryId: 'films' } }]);

    void deliver('library.regenerateTrickplay', [
      { id: 'job-sheets', data: { libraryId: 'films' } },
    ]);

    await expect(queue.cancelFor('films')).resolves.toBeGreaterThanOrEqual(2);
    expect(queue.isCancelled('job-scan')).toBe(true);
    expect(queue.isCancelled('job-sheets')).toBe(true);

    finish();
    await scanning;
  });

  it('sends a job to be picked up now, where nothing says to hold it back', async () => {
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: { 'library.scan': () => Promise.resolve() },
    });

    await queue.enqueue('library.scan', { libraryId: 'films' }, 'films');

    expect(boss.sent[0]?.options.startAfter).toBeUndefined();
    expect(boss.sent[0]?.options.singletonKey).toBe('films');
  });

  it('holds a job back for a while, for work that has to be asked for again later', async () => {
    const queue = await createJobQueue({
      connectionString: 'postgres://flux',
      handlers: { 'library.scan': () => Promise.resolve() },
    });

    await queue.enqueueAfter('library.scan', { libraryId: 'films' }, 30, 'films');

    expect(boss.sent[0]?.options.startAfter).toBe(30);
    expect(boss.sent[0]?.options.singletonKey).toBe('films');
  });
});
