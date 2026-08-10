import { z } from 'zod'

/**
 * The jobs Flux runs in the background.
 *
 * Scanning is the reason this exists: walking and probing a real library takes
 * minutes, and doing it inline means an HTTP request that times out while the
 * work carries on invisibly. See ADR-0005.
 */
const SCAN_LIBRARY_JOB = 'library.scan'

const ScanLibraryJobSchema = z.object({
  libraryId: z.string().uuid(),
})

type ScanLibraryJob = z.infer<typeof ScanLibraryJobSchema>

/**
 * Where a queued job has got to.
 */
const JobStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown'])

type JobState = z.infer<typeof JobStateSchema>

/**
 * The queue as the rest of the server sees it.
 *
 * A port rather than pg-boss directly, so the routes can be tested without
 * Postgres and so the queue can be swapped without touching call sites.
 */
type JobQueue = {
  enqueueScan: (libraryId: string) => Promise<string | null>
  readState: (jobId: string) => Promise<JobState>
  stop: () => Promise<void>
}

export type { JobQueue, JobState, ScanLibraryJob }

export default { SCAN_LIBRARY_JOB, ScanLibraryJobSchema, JobStateSchema }
