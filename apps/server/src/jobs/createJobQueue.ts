import { PgBoss } from 'pg-boss'
import type { Job } from 'pg-boss'
import JobQueueModule from './JobQueue'
import type { JobQueue, JobState } from './JobQueue'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { SCAN_LIBRARY_JOB, ScanLibraryJobSchema } = JobQueueModule

type CreateJobQueueOptions = {
  connectionString: string
  onScan: (libraryId: string, force: boolean) => Promise<void>
  onProblem?: (message: string) => void
}

const PG_BOSS_STATES: Record<string, JobState> = {
  created: 'queued',
  retry: 'queued',
  active: 'running',
  completed: 'completed',
  cancelled: 'failed',
  failed: 'failed',
}

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
  const boss = new PgBoss({ connectionString, schema: 'flux_jobs' })

  boss.on('error', (error: Error) => {
    onProblem?.(error.message)
  })

  await boss.start()
  await boss.createQueue(SCAN_LIBRARY_JOB)

  await boss.work(SCAN_LIBRARY_JOB, async (jobs: Job<JsonValue>[]) => {
    for (const job of jobs) {
      const parsed = ScanLibraryJobSchema.safeParse(job.data)

      if (!parsed.success) {
        onProblem?.('A scan job carried data Flux could not read.')

        continue
      }

      await onScan(parsed.data.libraryId, parsed.data.force)
    }
  })

  return {
    enqueueScan: (libraryId, force = false) =>
      boss.send(
        SCAN_LIBRARY_JOB,
        { libraryId, force },
        // Keyed on the library alone, so a forced scan and an ordinary one
        // never walk the same directory at once writing the same rows. A
        // forced scan asked for while one is already queued therefore joins
        // that scan rather than starting a second.
        { singletonKey: libraryId, retryLimit: 2, retryBackoff: true },
      ),

    readState: async (jobId) => {
      const job = await boss.getJobById(SCAN_LIBRARY_JOB, jobId)

      return job === null ? 'unknown' : (PG_BOSS_STATES[job.state] ?? 'unknown')
    },

    stop: async () => {
      await boss.stop()
    },
  }
}

export default { createJobQueue, PG_BOSS_STATES }
