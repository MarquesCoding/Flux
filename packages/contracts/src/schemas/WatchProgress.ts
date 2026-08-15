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
 * Whether a position is worth remembering at all.
 */
const isWorthResuming = (progress: WatchProgress): boolean =>
  !progress.isFinished &&
  progress.positionSeconds >= STARTED_AFTER_SECONDS &&
  progress.positionSeconds <= progress.durationSeconds - FINISHED_WITHIN_SECONDS;

/**
 * How far through something is, between nothing and everything.
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
