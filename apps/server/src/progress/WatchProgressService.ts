import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'

type ProgressReport = {
  mediaId: string
  positionSeconds: number
  durationSeconds: number
  isFinished: boolean
}

/**
 * Where each person got to, as the HTTP layer sees it.
 *
 * Keyed on a profile rather than an account, so that a household sharing one
 * login does not share one continue watching row — and so that moving somebody
 * to an account of their own carries their viewing with them.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one.
 */
type WatchProgressService = {
  list: (profileId: string) => Promise<WatchProgress[]>
  record: (profileId: string, report: ProgressReport) => Promise<void>
  forget: (profileId: string, mediaId: string) => Promise<void>
}

export type { ProgressReport, WatchProgressService }
