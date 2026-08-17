import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import type { JobProgress, JobQueue, JobState } from './JobQueue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

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
 * Starts the job queue and registers a worker for every kind of background work Flux does — scans,
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
  const boss = new PgBoss({ connectionString, schema: 'flux_jobs' });
  const kinds = Object.keys(handlers);

  const progressByJobId = new Map<string, JobProgress>();
  const running = new Map<string, { kind: string; subject: string | null }>();

  const cancelled = new Set<string>();

  /**
   * Reads what a job is about from its own payload — which library, which item — so that progress and
   * failures can be reported against something an operator recognises rather than against an
   * identifier.
   *
   * @param kind - The kind of job.
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
    const handler = handlers[kind];

    if (handler === undefined) {
      continue;
    }

    await boss.createQueue(kind);
    await boss.work(kind, async (jobs: Job<{ [key: string]: JsonValue }>[]) => {
      for (const job of jobs) {
        const subject = subjectOf(job.data);

        running.set(job.id, { kind, subject });

        try {
          await handler(job.id, job.data);

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

  return {
    enqueue: (kind, payload, singletonKey) =>
      boss.send(kind, payload, {
        ...(singletonKey === undefined ? {} : { singletonKey }),
        retryLimit: 2,
        retryBackoff: true,
        expireInSeconds: SCAN_EXPIRES_AFTER_SECONDS,
      }),

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

    isCancelled: (jobId) => cancelled.has(jobId),

    reportProgress: (jobId, phase, processed, total) => {
      progressByJobId.set(jobId, { phase, processed, total });
    },

    setSchedule: async (queueName, key, cron, timezone) => {
      await boss.schedule(queueName, cron, null, { key, tz: timezone });
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
