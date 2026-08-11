import { z } from 'zod'

/**
 * Where a viewer got to in something.
 *
 * Kept per viewer rather than per item: a household sharing a server does not
 * share a place in a film.
 */
const WatchProgressSchema = z.object({
  mediaId: z.string().uuid(),
  positionSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  isFinished: z.boolean(),
  updatedAt: z.string().datetime(),
})

const WatchProgressListSchema = z.object({ progress: z.array(WatchProgressSchema) })

/**
 * How far in something must be before it counts as started.
 *
 * Someone who opened a film and closed it again has not started watching it,
 * and offering to resume thirty seconds in is noise.
 */
const STARTED_AFTER_SECONDS = 60

/**
 * How close to the end counts as finished.
 *
 * Credits run for minutes. Somebody who stops during them has watched the
 * film, and asking them to resume it is asking them to sit through the credits.
 */
const FINISHED_WITHIN_SECONDS = 90

type WatchProgress = z.infer<typeof WatchProgressSchema>

/**
 * Whether a position is worth remembering at all.
 */
const isWorthResuming = (progress: WatchProgress): boolean =>
  !progress.isFinished &&
  progress.positionSeconds >= STARTED_AFTER_SECONDS &&
  progress.positionSeconds <= progress.durationSeconds - FINISHED_WITHIN_SECONDS

/**
 * How far through something is, between nothing and everything.
 */
const watchedFraction = (progress: WatchProgress): number => {
  if (progress.durationSeconds <= 0) {
    return 0
  }

  return Math.min(Math.max(progress.positionSeconds / progress.durationSeconds, 0), 1)
}

export type { WatchProgress }

export default {
  WatchProgressSchema,
  WatchProgressListSchema,
  isWorthResuming,
  watchedFraction,
  STARTED_AFTER_SECONDS,
  FINISHED_WITHIN_SECONDS,
}
