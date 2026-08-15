import { z } from 'zod';

const WatchProgressSchema = z.object({
  mediaId: z.string().uuid(),
  positionSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  isFinished: z.boolean(),
  updatedAt: z.string().datetime(),
});

const WatchProgressListSchema = z.object({ progress: z.array(WatchProgressSchema) });

const STARTED_AFTER_SECONDS = 60;

const FINISHED_WITHIN_SECONDS = 90;

type WatchProgress = z.infer<typeof WatchProgressSchema>;

/**
 * Decides whether to offer to carry on with something, which is a different question from where it
 * got to. Something barely started was probably opened by accident, and something within the credits
 * has been watched — offering either is offering a viewer their own mistake back.
 *
 * @param progress - Where this viewer got to, and how long the thing is.
 * @returns Whether resuming is worth suggesting.
 */
const isWorthResuming = (progress: WatchProgress): boolean =>
  !progress.isFinished &&
  progress.positionSeconds >= STARTED_AFTER_SECONDS &&
  progress.positionSeconds <= progress.durationSeconds - FINISHED_WITHIN_SECONDS;

/**
 * Works out how far through something a viewer is, as a fraction between nothing and everything, for
 * the bar drawn across the foot of a card. Anything with no duration reads as unwatched rather than
 * as divided by zero.
 *
 * @param progress - Where this viewer got to, and how long the thing is.
 * @returns A fraction from zero to one.
 */
const watchedFraction = (progress: WatchProgress): number => {
  if (progress.durationSeconds <= 0) {
    return 0;
  }

  return Math.min(Math.max(progress.positionSeconds / progress.durationSeconds, 0), 1);
};

export type { WatchProgress };

export {
  WatchProgressSchema,
  WatchProgressListSchema,
  isWorthResuming,
  watchedFraction,
  STARTED_AFTER_SECONDS,
  FINISHED_WITHIN_SECONDS,
};
