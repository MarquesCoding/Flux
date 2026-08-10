import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'

type ProgressReport = {
  mediaId: string
  positionSeconds: number
  durationSeconds: number
  isFinished: boolean
}

/**
 * Where each viewer got to, as the HTTP layer sees it.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one.
 */
type WatchProgressService = {
  list: (userId: string) => Promise<WatchProgress[]>
  record: (userId: string, report: ProgressReport) => Promise<void>
  forget: (userId: string, mediaId: string) => Promise<void>
}

export type { ProgressReport, WatchProgressService }

export default {}
