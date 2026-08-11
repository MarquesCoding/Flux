import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import { SCAN_LIBRARY_JOB, ScanLibraryJobSchema } from './JobQueue';
import type { JobProgress, JobQueue, JobState } from './JobQueue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type CreateJobQueueOptions = {
  connectionString: string;
  onScan: (libraryId: string, force: boolean, jobId: string) => Promise<void>;
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
  onScan,
  onProblem,
}: CreateJobQueueOptions): Promise<JobQueue> => {
  const boss = new PgBoss({ connectionString, schema: 'flux_jobs' });

  // Kept alongside pg-boss rather than in it: progress is a running number a
  // job reports about itself mid-flight, not the job's own queued/completed
  // lifecycle, and pg-boss has nowhere to put that. Lost on restart, which is
  // fine — a job that outlives the process reports from wherever it resumes.
  const progressByJobId = new Map<string, JobProgress>();

  boss.on('error', (error: Error) => {
    onProblem?.(error.message);
  });

  await boss.start();
  await boss.createQueue(SCAN_LIBRARY_JOB);

  await boss.work(SCAN_LIBRARY_JOB, async (jobs: Job<JsonValue>[]) => {
    for (const job of jobs) {
      const parsed = ScanLibraryJobSchema.safeParse(job.data);

      if (!parsed.success) {
        onProblem?.('A scan job carried data Flux could not read.');

        continue;
      }

      await onScan(parsed.data.libraryId, parsed.data.force, job.id);
    }
  });

  return {
    enqueueScan: (libraryId, force = false) =>
      boss.send(
        SCAN_LIBRARY_JOB,
        { libraryId, force },
        {
          // Keyed on the library alone, so a forced scan and an ordinary one
          // never walk the same directory at once writing the same rows. A
          // forced scan asked for while one is already queued therefore joins
          // that scan rather than starting a second.
          singletonKey: libraryId,
          retryLimit: 2,
          retryBackoff: true,
          // A scan that stops without saying so — the server restarted, the
          // process was killed — would otherwise hold the key for that library
          // forever, and every later scan would queue behind something that is
          // never coming back. This is the longest a scan may run before it is
          // treated as gone.
          expireInSeconds: SCAN_EXPIRES_AFTER_SECONDS,
        },
      ),

    readState: async (jobId) => {
      const job = await boss.getJobById(SCAN_LIBRARY_JOB, jobId);

      return job === null ? 'unknown' : (PG_BOSS_STATES[job.state] ?? 'unknown');
    },

    readProgress: (jobId) => progressByJobId.get(jobId) ?? null,

    reportProgress: (jobId, phase, processed, total) => {
      progressByJobId.set(jobId, { phase, processed, total });
    },

    stop: async () => {
      await boss.stop();
    },
  };
};

export { createJobQueue, PG_BOSS_STATES };
