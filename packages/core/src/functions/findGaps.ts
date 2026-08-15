import type { ShowDetail } from '@FluxContracts/schemas/Show';

type Gaps = {
  seasons: number[];
  episodes: Map<number, number[]>;
  isFromCatalogue: boolean;
};

/**
 * The whole numbers missing between the ends of a list.
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
