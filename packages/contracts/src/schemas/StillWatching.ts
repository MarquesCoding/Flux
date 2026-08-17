import { z } from 'zod';

const STILL_WATCHING_OFF = 0;

const STILL_WATCHING_DEFAULT = 4;

const STILL_WATCHING_MAX = 20;

const STILL_WATCHING_ANSWER_SECONDS = 90;

const StillWatchingSchema = z
  .number()
  .int()
  .min(STILL_WATCHING_OFF)
  .max(STILL_WATCHING_MAX)
  .default(STILL_WATCHING_DEFAULT);

/**
 * Whether to stop and ask before playing another episode nobody asked for.
 *
 * Counts episodes carried on to by themselves rather than time spent watching, because time is the
 * wrong signal: a three-hour film watched without touching anything is somebody engrossed, and four
 * episodes carried on to in a row is usually somebody asleep. Only an episode that follows another
 * counts — one chosen deliberately says the viewer is there.
 *
 * @param carriedOn - How many episodes have followed on their own since somebody last chose one.
 * @param askAfter - How many are allowed before asking, or zero to never ask.
 * @returns Whether to ask before playing another.
 */
const shouldAskStillWatching = (carriedOn: number, askAfter: number): boolean =>
  askAfter > STILL_WATCHING_OFF && carriedOn >= askAfter;

/**
 * Whether a profile has turned the question off altogether.
 *
 * @param askAfter - What the profile is set to.
 * @returns Whether it will never ask.
 */
const neverAsks = (askAfter: number): boolean => askAfter <= STILL_WATCHING_OFF;

export {
  StillWatchingSchema,
  STILL_WATCHING_OFF,
  STILL_WATCHING_DEFAULT,
  STILL_WATCHING_MAX,
  STILL_WATCHING_ANSWER_SECONDS,
  shouldAskStillWatching,
  neverAsks,
};
