import type { ShowDetail } from '@FluxContracts/schemas/Show';

type Gaps = {
  /**
   * Season numbers with no episodes at all, between the lowest and highest a
   * library holds.
   */
  seasons: number[];
  /**
   * Episode numbers absent from a season that is otherwise there, by season.
   */
  episodes: Map<number, number[]>;
};

/**
 * The whole numbers missing between the ends of a list.
 *
 * Only between: a list running 2, 3, 5 is missing 4, and says nothing about 1
 * or 6. Something outside the range on either side has left no evidence here,
 * and guessing at it is how a complete season gets told it is incomplete.
 */
const between = (numbers: number[]): number[] => {
  const present = new Set(numbers);
  const lowest = Math.min(...numbers);
  const highest = Math.max(...numbers);
  const absent: number[] = [];

  for (let candidate = lowest + 1; candidate < highest; candidate += 1) {
    if (!present.has(candidate)) {
      absent.push(candidate);
    }
  }

  return absent;
};

/**
 * What a series is missing, read from what it has.
 *
 * A library knows what it holds and nothing about what it does not, so this
 * answers the one question the numbering can answer on its own: which numbers
 * are skipped. An episode 9 sitting after an episode 7 is proof that episode 8
 * belongs to the series and is not here.
 *
 * It cannot see past the last episode of a season, and deliberately does not
 * try. A season of twelve with only eight held looks exactly like a season of
 * eight, and claiming four are missing on a hunch would put a warning on every
 * series still going out weekly. Filling that in needs the catalogue's own
 * episode list, which is not stored yet.
 *
 * Specials are left alone. They are numbered by no rule anybody agrees on, and
 * a season of them with 1, 2 and 5 is not evidence of anything.
 */
const findGaps = (show: ShowDetail): Gaps => {
  const numbered = show.seasons.filter(
    (season) => season.seasonNumber !== null && season.seasonNumber > 0,
  );

  const episodes = new Map<number, number[]>();

  for (const season of numbered) {
    const held = season.episodes
      .map((episode) => episode.episodeNumber)
      .filter((number): number is number => number !== null && number !== undefined);

    if (held.length === 0) {
      continue;
    }

    const absent = between(held);

    if (absent.length > 0 && season.seasonNumber !== null) {
      episodes.set(season.seasonNumber, absent);
    }
  }

  const held = numbered
    .map((season) => season.seasonNumber)
    .filter((number): number is number => number !== null);

  return {
    seasons: held.length === 0 ? [] : between(held),
    episodes,
  };
};

export { findGaps };
export type { Gaps };
