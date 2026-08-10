import WatchProgressModule from '@FluxContracts/schemas/WatchProgress'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'

import currentProfileModule from '@FluxWeb/profiles/currentProfile'

const { WatchProgressListSchema } = WatchProgressModule
const { profileHeaders } = currentProfileModule

/**
 * How often a position is sent while something is playing.
 *
 * Often enough that closing a laptop loses seconds rather than minutes, rarely
 * enough that a two hour film is a few hundred small requests instead of tens
 * of thousands.
 */
const REPORT_EVERY_MILLISECONDS = 10_000

/**
 * Reads where this viewer got to in everything.
 *
 * Answers with nothing rather than throwing: a progress bar is an addition to
 * a library, and its absence must not stop one being browsed.
 */
const fetchWatchProgress = async (): Promise<WatchProgress[]> => {
  try {
    const response = await fetch('/api/progress', {
      headers: { accept: 'application/json', ...profileHeaders() },
    })

    if (!response.ok) {
      return []
    }

    return WatchProgressListSchema.parse(await response.json()).progress
  } catch {
    return []
  }
}

/**
 * Records where this viewer has got to.
 *
 * Best effort, and deliberately quiet about failure: someone watching a film
 * should never be interrupted to be told their bookmark did not save.
 */
const reportWatchProgress = async (
  mediaId: string,
  report: { positionSeconds: number; durationSeconds: number; isFinished?: boolean },
): Promise<void> => {
  try {
    await fetch(`/api/media/${mediaId}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...profileHeaders() },
      body: JSON.stringify({ isFinished: false, ...report }),
    })
  } catch {
    // Nothing useful to say, and nothing worth saying it over.
  }
}

/**
 * Turns a list into something a card can ask one question of.
 */
const byMediaId = (progress: WatchProgress[]): Map<string, WatchProgress> =>
  new Map(progress.map((entry) => [entry.mediaId, entry]))

export type { WatchProgress }

export default {
  fetchWatchProgress,
  reportWatchProgress,
  byMediaId,
  REPORT_EVERY_MILLISECONDS,
}
