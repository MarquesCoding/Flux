type Beat = {
  positionSeconds: number;
  atMs: number;
  isPlaying: boolean;
};

const MOST_PER_GAP_SECONDS = 60;

/**
 * Works out how much watching happened between two reports. A gap far longer than the position
 * moved means somebody paused or walked away, and counting the wall clock would credit them with
 * watching a film they were not in the room for.
 *
 * @param earlier - The earlier report.
 * @param later - The report after it.
 * @returns The seconds actually watched between them.
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
 * Adds up how much of a run of reports was actually watched, pair by pair, which is what the usage
 * figures on the admin pages are built from.
 *
 * @param reports - The reports, oldest first.
 * @returns The total seconds watched.
 */
const accumulateWatchTime = (beats: readonly Beat[]): number =>
  beats.reduce(
    (total, beat, at) => (at === 0 ? total : total + watchedBetween(beats[at - 1] ?? beat, beat)),
    0,
  );

export type { Beat };

export { accumulateWatchTime, watchedBetween, MOST_PER_GAP_SECONDS };
