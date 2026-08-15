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
 * Starts the job queue.
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
   * What a job is about, read from its own payload.
   */
  const subjectOf = (payload: { [key: string]: JsonValue }): string | null =>
    typeof payload['libraryId'] === 'string' ? payload['libraryId'] : null;

  /**
   * Drops a job that has not started, holding the stop flag across the gap.
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

    setSchedule: async (queueName, key, cron) => {
      await boss.schedule(queueName, cron, null, { key });
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
      }));
    },

    stop: async () => {
      await boss.stop();
    },
  };
};

export type { FinishedJob, JobHandler };

export { createJobQueue, PG_BOSS_STATES };
