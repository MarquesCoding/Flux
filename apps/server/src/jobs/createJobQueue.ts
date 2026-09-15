import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import { scheduleSendOptions } from './scheduleSendOptions';
import { readJobPayload } from './readJobPayload';
import type { JobProgress, JobQueue, JobState } from './JobQueue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type JobHandler = (jobId: string, payload: { [key: string]: JsonValue }) => Promise<void>;

type FinishedJob = {
  kind: string;
  jobId: string;
  subject: string | null;
  reason: string | null;
};

type CreateJobQueueOptions = {
  connectionString: string;
  handlers: Record<string, JobHandler>;
  onProblem?: (message: string) => void;
  onFinished?: (finished: FinishedJob) => void;
};

const SCAN_EXPIRES_AFTER_SECONDS = 2 * 60 * 60;

const PG_BOSS_STATES: Record<string, JobState> = {
  created: 'queued',
  retry: 'queued',
  active: 'running',
  completed: 'completed',
  cancelled: 'failed',
  failed: 'failed',
};

/**
 * Starts the job queue and registers a worker for every kind of background work Valence does — scans,
 * previews, thumbnails, artwork, webhook deliveries. Work outlives the request that asked for it and
 * survives a restart, which is the whole reason a queue exists rather than a promise.
 *
 * @param options - The database to keep the queue in, and the handlers for each kind of job.
 * @returns The queue, ready to be enqueued against.
 */
const createJobQueue = async ({
  connectionString,
  handlers,
  onProblem,
  onFinished,
}: CreateJobQueueOptions): Promise<JobQueue> => {
  const boss = new PgBoss({ connectionString, schema: 'valence_jobs' });
  const kinds = Object.keys(handlers);

  const progressByJobId = new Map<string, JobProgress>();
  const running = new Map<string, { kind: string; subject: string | null }>();

  const cancelled = new Set<string>();

  /**
   * Reads what a job is about from its own payload — which library, which item — so that progress and
   * failures can be reported against something an operator recognises rather than against an
   * identifier.
   *
   * @param payload - What it was enqueued with.
   * @returns What the job is about, or null where its payload names nothing.
   */
  const subjectOf = (payload: { [key: string]: JsonValue }): string | null =>
    typeof payload['libraryId'] === 'string' ? payload['libraryId'] : null;

  /**
   * Cancels a job that has not started yet, and remembers that it was cancelled for long enough that a
   * worker picking it up in the same moment stops rather than running it — pg-boss has no way to
   * withdraw a job that is already being fetched.
   *
   * @param kind - The queue it is on.
   * @param jobId - The job to drop.
   */
  const dropQueued = async (kind: string, jobId: string): Promise<void> => {
    cancelled.add(jobId);

    await boss.cancel(kind, jobId);

    if (!running.has(jobId)) {
      cancelled.delete(jobId);
    }
  };

  boss.on('error', (error: Error) => {
    onProblem?.(error.message);
  });

  await boss.start();

  for (const kind of kinds) {
    if (handlers[kind] !== undefined) {
      await boss.createQueue(kind);
    }
  }

  const startWorking = async (): Promise<void> => {
    for (const kind of kinds) {
      const handler = handlers[kind];

      if (handler === undefined) {
        continue;
      }

      await boss.work(kind, async (jobs: Job<JsonValue>[]) => {
        for (const job of jobs) {
          const payload = readJobPayload(job.data);
          const subject = subjectOf(payload);

          running.set(job.id, { kind, subject });

          try {
            await handler(job.id, payload);

            onFinished?.({ kind, jobId: job.id, subject, reason: null });
          } catch (error) {
            onFinished?.({
              kind,
              jobId: job.id,
              subject,
              reason: error instanceof Error ? error.message : 'The job failed.',
            });

            throw error;
          } finally {
            running.delete(job.id);
            progressByJobId.delete(job.id);
            cancelled.delete(job.id);
          }
        }
      });
    }
  };

  /**
   * Puts a job on its queue, optionally under a key that keeps a second of its kind from waiting
   * behind it and optionally held back for a while.
   *
   * @param kind - The queue to put it on.
   * @param payload - What the job needs to know.
   * @param singletonKey - What it collapses against, where it should collapse at all.
   * @param startAfter - How many seconds to leave it before it may be picked up.
   * @returns The id of the job, or null where something already held the key.
   */
  const send = (
    kind: string,
    payload: { [key: string]: JsonValue },
    singletonKey: string | undefined,
    startAfter: number | undefined,
  ): Promise<string | null> =>
    boss.send(kind, payload, {
      ...(singletonKey === undefined ? {} : { singletonKey }),
      ...(startAfter === undefined ? {} : { startAfter }),
      retryLimit: 2,
      retryBackoff: true,
      expireInSeconds: SCAN_EXPIRES_AFTER_SECONDS,
    });

  return {
    startWorking,

    enqueue: (kind, payload, singletonKey) => send(kind, payload, singletonKey, undefined),

    enqueueAfter: (kind, payload, seconds, singletonKey) =>
      send(kind, payload, singletonKey, seconds),

    readState: async (jobId) => {
      for (const kind of kinds) {
        const job = await boss.getJobById(kind, jobId);

        if (job !== null) {
          return PG_BOSS_STATES[job.state] ?? 'unknown';
        }
      }

      return 'unknown';
    },

    readProgress: (jobId) => progressByJobId.get(jobId) ?? null,

    listRunning: () =>
      [...running].map(([jobId, about]) => ({
        jobId,
        kind: about.kind,
        subject: about.subject,
        progress: progressByJobId.get(jobId) ?? null,
      })),

    liveJob: async (kind, subject) => {
      for (const [jobId, about] of running) {
        if (about.kind === kind && (subject === undefined || about.subject === subject)) {
          return jobId;
        }
      }

      const waiting = await boss.findJobs(kind, {
        ...(subject === undefined ? {} : { data: { libraryId: subject } }),
        queued: true,
      });

      return waiting[0]?.id ?? null;
    },

    cancel: async (jobId) => {
      if (running.has(jobId)) {
        cancelled.add(jobId);

        return true;
      }

      for (const kind of kinds) {
        const job = await boss.getJobById(kind, jobId);

        if (job !== null) {
          if (PG_BOSS_STATES[job.state] !== 'queued') {
            return false;
          }

          await dropQueued(kind, jobId);

          return true;
        }
      }

      return false;
    },

    cancelFor: async (subject) => {
      let stopped = 0;

      for (const [jobId, about] of running) {
        if (about.subject === subject) {
          cancelled.add(jobId);
          stopped += 1;
        }
      }

      for (const kind of kinds) {
        if (handlers[kind] === undefined) {
          continue;
        }

        const waiting = await boss.findJobs(kind, { data: { libraryId: subject }, queued: true });

        for (const job of waiting) {
          await dropQueued(kind, job.id);
          stopped += 1;
        }
      }

      return stopped;
    },

    isCancelled: (jobId) => cancelled.has(jobId),

    reportProgress: (jobId, phase, processed, total) => {
      progressByJobId.set(jobId, { phase, processed, total });
    },

    setSchedule: async (queueName, key, cron, timezone) => {
      await boss.schedule(queueName, cron, {}, scheduleSendOptions(queueName, key, timezone));
    },

    clearSchedule: async (queueName, key) => {
      await boss.unschedule(queueName, key).catch(() => {});
    },

    listSchedules: async () => {
      const schedules = await boss.getSchedules();

      return schedules.map((schedule) => ({
        queueName: schedule.name,
        key: schedule.key,
        cron: schedule.cron,
        timezone: schedule.timezone,
      }));
    },

    stop: async () => {
      await boss.stop();
    },
  };
};

export type { FinishedJob, JobHandler };

export { createJobQueue };
