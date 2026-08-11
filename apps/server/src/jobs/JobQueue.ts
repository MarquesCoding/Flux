import { z } from 'zod';

/**
 * The jobs Flux runs in the background.
 *
 * Scanning is the reason this exists: walking and probing a real library takes
 * minutes, and doing it inline means an HTTP request that times out while the
 * work carries on invisibly. See ADR-0005.
 */
const SCAN_LIBRARY_JOB = 'library.scan';

const ScanLibraryJobSchema = z.object({
  libraryId: z.string().uuid(),
  /**
   * Whether every file should be probed again rather than only changed ones.
   */
  force: z.boolean().default(false),
});

type ScanLibraryJob = z.infer<typeof ScanLibraryJobSchema>;

/**
 * Where a queued job has got to.
 */
const JobStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown']);

type JobState = z.infer<typeof JobStateSchema>;

/**
 * How far a running job has got.
 *
 * `phase` names what it is doing right now — a job with more than one kind
 * of work reports a fresh `processed`/`total` for each, rather than one
 * number that has to somehow mean both.
 */
type JobProgress = {
  phase: string;
  processed: number;
  total: number;
};

/**
 * The queue as the rest of the server sees it.
 *
 * A port rather than pg-boss directly, so the routes can be tested without
 * Postgres and so the queue can be swapped without touching call sites.
 */
type JobQueue = {
  enqueueScan: (libraryId: string, force?: boolean) => Promise<string | null>;
  readState: (jobId: string) => Promise<JobState>;
  /**
   * What a running job last reported about itself.
   *
   * Null until the job has reported anything, which is also true of a job
   * that does not report progress at all.
   */
  readProgress: (jobId: string) => JobProgress | null;
  reportProgress: (jobId: string, phase: string, processed: number, total: number) => void;
  stop: () => Promise<void>;
};

export type { JobProgress, JobQueue, JobState, ScanLibraryJob };

export { SCAN_LIBRARY_JOB, ScanLibraryJobSchema, JobStateSchema };
