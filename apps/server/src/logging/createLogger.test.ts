import { describe, expect, it } from 'vitest';
import { createLogger } from './createLogger';
import type { LogStore, StoredLog } from './Logger';
import type { Schedule } from '@FluxServer/realtime/createCoalescer';
import type { LogContext, LogRecord } from '@FluxContracts/schemas/Log';

const createWorld = (options?: {
  failing?: boolean;
  dedupeWindowMs?: number;
  ambient?: Partial<LogContext>;
}) => {
  const saved: StoredLog[] = [];
  const counted: string[] = [];
  const lines: string[] = [];
  const tailed: LogRecord[] = [];
  const due: (() => void)[] = [];
  let clock = 1000;
  let minted = 0;

  const schedule: Schedule = (run) => {
    due.push(run);

    return () => {
      const at = due.indexOf(run);

      if (at >= 0) {
        due.splice(at, 1);
      }
    };
  };

  const asked: Promise<void>[] = [];

  const store: LogStore = {
    save: (records) => {
      if (options?.failing === true) {
        const refused = Promise.reject(new Error('the database has gone away'));

        asked.push(refused.catch(() => {}));

        return refused;
      }

      saved.push(...records);

      const done = Promise.resolve();

      asked.push(done);

      return done;
    },
    countAgain: (ids) => {
      counted.push(...ids);

      return Promise.resolve();
    },
    read: () => Promise.resolve({ records: [], total: 0 }),
    forgetExpired: () => Promise.resolve(0),
  };

  const logger = createLogger({
    store,
    now: () => clock,
    newId: () => {
      minted += 1;

      return `record-${minted.toString()}`;
    },
    schedule,
    writeLine: (line) => lines.push(line),
    windowMs: 50,
    batchSize: 100,
    dedupeWindowMs: options?.dedupeWindowMs ?? 60_000,
    ambient: () => options?.ambient ?? {},
    onRecord: (record) => tailed.push(record),
  });

  return {
    logger,
    saved,
    counted,
    lines,
    tailed,
    advance: (byMs: number) => {
      clock += byMs;
    },
    settle: async () => {
      await Promise.all(asked);
    },
    tick: () => {
      for (const run of due.splice(0, due.length)) {
        run();
      }
    },
  };
};

describe('createLogger', () => {
  it('stores what it was told', async () => {
    const world = createWorld();

    world.logger.error('scanner', 'could not read the file');
    await world.logger.flush();

    expect(world.saved).toHaveLength(1);
    expect(world.saved[0]?.message).toBe('could not read the file');
  });

  it('writes to stderr at once, since that is all there is when the process dies', () => {
    const world = createWorld();

    world.logger.error('scanner', 'could not read the file');

    expect(world.lines).toHaveLength(1);
  });

  it('says the level, the source and the time on the immediate line', () => {
    const world = createWorld();

    world.logger.warn('jobs', 'the queue is behind');

    expect(world.lines[0]).toContain('warn');
    expect(world.lines[0]).toContain('jobs');
    expect(world.lines[0]).toContain('1970-01-01T00:00:01.000Z');
  });

  it('does not store anything until the window closes', () => {
    const world = createWorld();

    world.logger.info('scanner', 'started');

    expect(world.saved).toStrictEqual([]);
  });

  it('stores what gathered once the window closes', async () => {
    const world = createWorld();

    world.logger.info('scanner', 'started');
    world.tick();
    await world.settle();

    expect(world.saved).toHaveLength(1);
  });

  it('does not wait for the window when enough have gathered', async () => {
    const world = createWorld();

    for (let index = 0; index < 100; index += 1) {
      world.logger.info('scanner', `read file ${index.toString()}`);
    }

    await world.settle();

    expect(world.saved).toHaveLength(100);
  });

  it('redacts a secret when the record is made, not when it is shown', async () => {
    const world = createWorld();

    world.logger.error('catalogue', 'https://api.themoviedb.org/3/movie?api_key=abcdef0123456789');
    await world.logger.flush();

    expect(world.saved[0]?.message).not.toContain('abcdef0123456789');
  });

  it('redacts the immediate stderr copy too, since that is also readable', () => {
    const world = createWorld();

    world.logger.error('catalogue', 'key api_key=abcdef0123456789 rejected');

    expect(world.lines[0]).not.toContain('abcdef0123456789');
  });

  it('redacts the detail, which is where a stack trace puts a URL', async () => {
    const world = createWorld();

    world.logger.error('catalogue', 'failed', {
      detail: 'at fetch(https://x/y?api_key=abcdef0123456789)',
    });
    await world.logger.flush();

    expect(world.saved[0]?.detail).not.toContain('abcdef0123456789');
  });

  it('counts a repeat rather than storing it again', async () => {
    const world = createWorld();

    world.logger.error('scanner', 'unreadable');
    world.logger.error('scanner', 'unreadable');
    await world.logger.flush();

    expect(world.saved).toHaveLength(1);
    expect(world.counted).toStrictEqual(['record-1']);
  });

  it('survives a flood without pushing out what mattered', async () => {
    const world = createWorld();

    world.logger.error('jobs', 'the job that actually failed');

    for (let index = 0; index < 4000; index += 1) {
      world.logger.warn('scanner', 'unreadable');
    }

    await world.logger.flush();

    expect(world.saved.filter((one) => one.source === 'scanner')).toHaveLength(1);
    expect(world.saved.some((one) => one.message === 'the job that actually failed')).toBe(true);
  });

  it('treats the same message about two files as two events', async () => {
    const world = createWorld();

    world.logger.error('scanner', 'unreadable', { context: { mediaId: 'one' } });
    world.logger.error('scanner', 'unreadable', { context: { mediaId: 'two' } });
    await world.logger.flush();

    expect(world.saved).toHaveLength(2);
  });

  it('stores a repeat again once it is no longer the same burst', async () => {
    const world = createWorld({ dedupeWindowMs: 1000 });

    world.logger.error('scanner', 'unreadable');
    world.advance(2000);
    world.logger.error('scanner', 'unreadable');
    await world.logger.flush();

    expect(world.saved).toHaveLength(2);
  });

  it('carries the context it was given', async () => {
    const world = createWorld();

    world.logger.error('jobs', 'failed', { context: { jobId: 'job-1', jobKind: 'scan' } });
    await world.logger.flush();

    expect(world.saved[0]?.context.jobId).toBe('job-1');
    expect(world.saved[0]?.context.jobKind).toBe('scan');
  });

  it('carries context held for a whole job without repeating it at each call', async () => {
    const world = createWorld();
    const forJob = world.logger.about({ jobId: 'job-1', jobKind: 'scan' });

    forJob.warn('scanner', 'skipped one');
    forJob.warn('scanner', 'skipped another');
    await world.logger.flush();

    expect(world.saved.every((one) => one.context.jobId === 'job-1')).toBe(true);
  });

  it('lets a single call add to the context it was given', async () => {
    const world = createWorld();

    world.logger
      .about({ jobId: 'job-1' })
      .warn('scanner', 'skipped', { context: { mediaId: 'media-1' } });
    await world.logger.flush();

    expect(world.saved[0]?.context).toMatchObject({ jobId: 'job-1', mediaId: 'media-1' });
  });

  it('leaves the parent logger alone when a child adds context', async () => {
    const world = createWorld();

    world.logger.about({ jobId: 'job-1' });
    world.logger.warn('scanner', 'unrelated');
    await world.logger.flush();

    expect(world.saved[0]?.context.jobId).toBeNull();
  });

  it('takes the context of the work running, so a line deep in a scan says which scan', async () => {
    const world = createWorld({ ambient: { jobId: 'job-1', jobKind: 'scan' } });

    world.logger.warn('scanner', 'skipped a file');
    await world.logger.flush();

    expect(world.saved[0]?.context.jobId).toBe('job-1');
  });

  it('does not let the empty context of a plain logger wipe what the work said', async () => {
    const world = createWorld({ ambient: { jobId: 'job-1' } });

    world.logger.about({ libraryId: 'library-1' }).warn('scanner', 'skipped');
    await world.logger.flush();

    expect(world.saved[0]?.context).toMatchObject({ jobId: 'job-1', libraryId: 'library-1' });
  });

  it('lets a caller that knows better say something more specific', async () => {
    const world = createWorld({ ambient: { jobId: 'job-1' } });

    world.logger.warn('scanner', 'skipped', { context: { jobId: 'job-2' } });
    await world.logger.flush();

    expect(world.saved[0]?.context.jobId).toBe('job-2');
  });

  it('says when a record should be forgotten, so retention has something to work from', async () => {
    const world = createWorld();

    world.logger.error('scanner', 'unreadable');
    await world.logger.flush();

    expect(world.saved[0]?.forgetAfterMs).toBeGreaterThan(1000);
  });

  it('forgets an error later than an info written at the same moment', async () => {
    const world = createWorld();

    world.logger.info('scanner', 'a');
    world.logger.error('scanner', 'b');
    await world.logger.flush();

    const info = world.saved.find((one) => one.level === 'info');
    const error = world.saved.find((one) => one.level === 'error');

    expect(error?.forgetAfterMs).toBeGreaterThan(info?.forgetAfterMs ?? 0);
  });

  it('does not throw when the store has gone away', async () => {
    const world = createWorld({ failing: true });

    world.logger.error('scanner', 'unreadable');

    await expect(world.logger.flush()).resolves.toBeUndefined();
  });

  it('says on stderr that a log could not be stored, rather than losing it silently', async () => {
    const world = createWorld({ failing: true });

    world.logger.error('scanner', 'unreadable');
    await world.logger.flush();

    expect(world.lines.some((line) => line.includes('could not be stored'))).toBe(true);
  });

  it('keeps working after the store has failed once', async () => {
    const world = createWorld({ failing: true });

    world.logger.error('scanner', 'first');
    await world.logger.flush();
    world.logger.error('scanner', 'second');

    expect(world.lines.some((line) => line.includes('second'))).toBe(true);
  });

  it('tells a tail about a record as it happens, not when the batch is saved', () => {
    const world = createWorld();

    world.logger.error('scanner', 'unreadable');

    expect(world.tailed).toHaveLength(1);
  });

  it('gives a tail the redacted record', () => {
    const world = createWorld();

    world.logger.error('catalogue', 'api_key=abcdef0123456789 rejected');

    expect(world.tailed[0]?.message).not.toContain('abcdef0123456789');
  });

  it('does not tell a tail about a repeat, which would be the flood all over again', () => {
    const world = createWorld();

    world.logger.error('scanner', 'unreadable');
    world.logger.error('scanner', 'unreadable');

    expect(world.tailed).toHaveLength(1);
  });
});
