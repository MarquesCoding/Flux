import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import type { JobProgress, JobQueue, JobState } from './JobQueue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

/**
 * What runs a job of a given kind once pg-boss hands it over.
 *
 * Registered per kind in `handlers` rather than as bespoke queue options, so
 * a new job kind is added by registering a handler here, not by changing
 * this file.
 */
type JobHandler = (jobId: string, payload: { [key: string]: JsonValue }) => Promise<void>;

type CreateJobQueueOptions = {
  connectionString: string;
  handlers: Record<string, JobHandler>;
  onProblem?: (message: string) => void;
};

/**
 * How long a scan may run before it is presumed dead.
 *
 * Generous, because a first scan of a large library really does take a long
 * time: this is the point at which an unfinished scan stops blocking the next
 * one, not a target.
 */
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
 *
 * Backed by the same Postgres as everything else, so a scan can be enqueued in
 * the same transaction as the rows it will act on, and one `pg_dump` captures
 * queued work along with the data. That transactional property is what
 * ADR-0005 gave up Redis throughput for.
 *
 * Scans are singleton per library: pressing scan twice must not run two walks
 * over the same directory competing to write the same rows.
 */
const createJobQueue = async ({
  connectionString,
  handlers,
  onProblem,
}: CreateJobQueueOptions): Promise<JobQueue> => {
  const boss = new PgBoss({ connectionString, schema: 'flux_jobs' });
  const kinds = Object.keys(handlers);

  const progressByJobId = new Map<string, JobProgress>();

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
        await handler(job.id, job.data);
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

export type { JobHandler };

export { createJobQueue, PG_BOSS_STATES };
