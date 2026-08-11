import type { ShowDetail } from '@FluxContracts/schemas/Show';

type Gaps = {
  /**
   * Season numbers the series has and the library holds nothing of.
   */
  seasons: number[];
  /**
   * Episode numbers absent from a season that is otherwise there, by season.
   */
  episodes: Map<number, number[]>;
  /**
   * Whether a catalogue told us what the series contains.
   *
   * False means the gaps below are only what the numbering betrays, and the
   * end of a season cannot be seen. Anything reporting a series as complete
   * has to say which of the two answers it is giving.
   */
  isFromCatalogue: boolean;
};

/**
 * The whole numbers missing between the ends of a list.
 *
 * Only between: a list running 2, 3, 5 is missing 4, and says nothing about 1
 * or 6. Something outside the range on either side has left no evidence, and
 * guessing at it is how a complete season gets told it is incomplete.
 */
const between = (numbers: number[]): number[] => {
  const present = new Set(numbers);
  const absent: number[] = [];

  for (let candidate = Math.min(...numbers) + 1; candidate < Math.max(...numbers); candidate += 1) {
    if (!present.has(candidate)) {
      absent.push(candidate);
    }
  }

  return absent;
};

/**
 * The whole numbers from one up to a count that a list does not have.
 */
const upTo = (numbers: number[], count: number): number[] => {
  const present = new Set(numbers);
  const absent: number[] = [];

  for (let candidate = 1; candidate <= count; candidate += 1) {
    if (!present.has(candidate)) {
      absent.push(candidate);
    }
  }

  return absent;
};

/**
 * The episode numbers a season holds.
 */
const numbersIn = (show: ShowDetail, seasonNumber: number): number[] =>
  (show.seasons.find((season) => season.seasonNumber === seasonNumber)?.episodes ?? [])
    .map((episode) => episode.episodeNumber)
    .filter((number): number is number => number !== null && number !== undefined);

/**
 * What a series is missing.
 *
 * Answered two ways, and which one matters. Where a catalogue has said what the
 * series contains, this is the real answer: a season of twelve holding eight is
 * missing four, a season nobody holds is missing entirely, and specials count
 * like anything else. Where nothing has said — no catalogue configured, the
 * series never matched, the service down — it falls back to what the numbering
 * alone betrays: an episode 9 after an episode 7 proves episode 8 exists.
 *
 * The fallback deliberately cannot see past the end of a season. A season of
 * twelve holding eight looks exactly like a season of eight, and guessing would
 * put a warning on every series still going out weekly. `isFromCatalogue` says
 * which answer this is, so nothing downstream calls a series complete when it
 * only means "no holes I can prove".
 *
 * Specials are skipped in the fallback for the same reason: they are numbered
 * by no rule anybody agrees on, so a gap among them is not evidence. Given a
 * catalogue, they are counted like any other season.
 */
const findGaps = (show: ShowDetail): Gaps => {
  const shape = show.shape ?? null;

  if (shape !== null && shape.length > 0) {
    const episodes = new Map<number, number[]>();
    const seasons: number[] = [];

    for (const season of shape) {
      if (season.episodeCount === 0) {
        continue;
      }

      const held = numbersIn(show, season.seasonNumber);

      if (held.length === 0) {
        seasons.push(season.seasonNumber);

        continue;
      }

      const absent = upTo(held, season.episodeCount);

      if (absent.length > 0) {
        episodes.set(season.seasonNumber, absent);
      }
    }

    return { seasons, episodes, isFromCatalogue: true };
  }

  const numbered = show.seasons.filter(
    (season) => season.seasonNumber !== null && season.seasonNumber > 0,
  );

  const episodes = new Map<number, number[]>();

  for (const season of numbered) {
    const held = numbersIn(show, season.seasonNumber ?? 0);

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
    isFromCatalogue: false,
  };
};

export { findGaps };
export type { Gaps };
