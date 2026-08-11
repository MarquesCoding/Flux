import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator'

/**
 * The order a scan's stages run in.
 *
 * A job runs the same chain against every library at once, and they do not
 * keep step — one library can be finding intros while another is still
 * probing. Ranking the stages lets one bar report the stage the job as a
 * whole is still on, rather than whichever library happens to be furthest
 * ahead.
 */
const PHASE_ORDER: readonly string[] = ['probing', 'previews', 'trickplay', 'segments']

type ProgressSummary = {
  phase: string | null
  processed: number | null
  total: number | null
}

/**
 * How far along a stage is, where a job reports one per library it is
 * working through.
 *
 * A stage this module has never heard of sorts last, so a job kind added to
 * the server after this file was written still reports something sensible
 * rather than claiming to be at the beginning. A library that has not said
 * anything yet sorts first, because a job that has only just started is at
 * the start whatever the others are doing.
 */
const rankOf = (phase: string | null): number => {
  if (phase === null) {
    return -1
  }

  const index = PHASE_ORDER.indexOf(phase)

  return index === -1 ? PHASE_ORDER.length : index
}

/**
 * Folds every library's progress on one job into the single bar its row
 * shows.
 *
 * Null when nothing is running, which is what puts the Run button back.
 *
 * Counts are summed only across the libraries on the same stage: each stage
 * counts its own files from zero, so adding one stage's total to another's
 * would produce a number that means nothing and a bar that goes backwards.
 */
const summariseProgress = (entries: ScanEntry[]): ProgressSummary | null => {
  if (entries.length === 0) {
    return null
  }

  const earliest = Math.min(...entries.map((entry) => rankOf(entry.phase)))
  const onStage = entries.filter((entry) => rankOf(entry.phase) === earliest)
  const phase = onStage[0]?.phase ?? null
  const counted = onStage.filter((entry) => entry.processed !== null && entry.total !== null)

  if (counted.length === 0) {
    return { phase, processed: null, total: null }
  }

  return {
    phase,
    processed: counted.reduce((sum, entry) => sum + (entry.processed ?? 0), 0),
    total: counted.reduce((sum, entry) => sum + (entry.total ?? 0), 0),
  }
}

export type { ProgressSummary }

export default { summariseProgress, PHASE_ORDER }
