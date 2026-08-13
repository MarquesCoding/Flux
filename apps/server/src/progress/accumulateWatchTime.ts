/**
 * What one report from a player says about where it is.
 */
type Beat = {
  /**
   * Where in the content it is, in seconds.
   */
  positionSeconds: number;
  /**
   * When the report was made.
   */
  atMs: number;
  isPlaying: boolean;
};

/**
 * The longest a single gap between reports may contribute.
 *
 * A player that dies without saying goodbye — a closed laptop, a lost network,
 * a tab discarded by the browser — leaves its last report standing until
 * something else arrives, which can be hours later. Without a ceiling, that
 * gap is credited as watching and one abandoned tab outweighs a household's
 * real viewing.
 *
 * Set at twice the reporting interval, so an ordinary late report still counts
 * in full and a silence longer than that counts as one interval rather than as
 * however long nobody was looking.
 */
const MOST_PER_GAP_SECONDS = 60;

/**
 * How much watching happened between two reports.
 *
 * The smaller of how much time passed and how far the content moved, which is
 * what makes the figure honest in both directions:
 *
 * - **A backwards seek** moves the position by a negative amount. It is
 *   discarded rather than subtracted: rewinding to catch a line of dialogue is
 *   not un-watching the last ten minutes.
 * - **A forward skip** — an intro, a scrub across an act — moves the position
 *   far further than time passed. Elapsed time caps it, so skipping ahead
 *   cannot be counted as having watched what was skipped.
 * - **Paused** contributes nothing, however long it lasts. This is the whole
 *   reason wall-clock time between starting and stopping is the wrong measure:
 *   it counts somebody who walked away, and it counts somebody asleep three
 *   episodes deep.
 *
 * Speed is deliberately not corrected for. At one and a half times, an hour of
 * content takes forty minutes, and this counts the hour — because "I watched
 * three hours of television" means three hours of television, not of clock.
 * Both readings are defensible; this one is the one people mean, and the
 * interface should say which it is showing.
 */
const watchedBetween = (before: Beat, after: Beat): number => {
  if (!before.isPlaying) {
    return 0;
  }

  const elapsed = Math.min((after.atMs - before.atMs) / 1000, MOST_PER_GAP_SECONDS);
  const moved = after.positionSeconds - before.positionSeconds;

  if (elapsed <= 0 || moved <= 0) {
    return 0;
  }

  return Math.min(elapsed, moved);
};

/**
 * How much of a run of reports was actually watched.
 *
 * Reports are taken in the order given. Anything that arrived out of order —
 * a retried request, two tabs interleaving — contributes nothing rather than a
 * negative, because `watchedBetween` refuses a gap that did not move forwards
 * in both time and content.
 */
const accumulateWatchTime = (beats: readonly Beat[]): number =>
  beats.reduce(
    (total, beat, at) => (at === 0 ? total : total + watchedBetween(beats[at - 1] ?? beat, beat)),
    0,
  );

export type { Beat };

export { accumulateWatchTime, watchedBetween, MOST_PER_GAP_SECONDS };
