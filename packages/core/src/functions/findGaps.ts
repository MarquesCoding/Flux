import type { ShowDetail } from '@FluxContracts/schemas/Show';

type Gaps = {
  seasons: number[];
  episodes: Map<number, number[]>;
  isFromCatalogue: boolean;
};

/**
 * Finds the whole numbers absent from between the smallest and largest a list holds, so a shelf
 * holding episodes one, two and five is missing three and four — and is not considered to be
 * missing anything beyond five, since nothing here says how many there were.
 *
 * @param numbers - The numbers present, in any order.
 * @returns The numbers absent from between the ends, ascending.
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
 * Finds which of the numbers from one up to a known total a list does not hold. Used where a
 * catalogue has said how many episodes a season has, so absence past the last one held is real
 * absence rather than the end of the shelf.
 *
 * @param numbers - The numbers present, in any order.
 * @param count - How many there should be in total.
 * @returns The missing numbers, ascending.
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
 * Reads the episode numbers one season of a programme actually holds, ignoring any episode the
 * scanner could not number.
 *
 * @param show - The programme, with its seasons and their episodes.
 * @param seasonNumber - The season being asked about.
 * @returns The episode numbers held, in the order the season lists them.
 */
const numbersIn = (show: ShowDetail, seasonNumber: number): number[] =>
  (show.seasons.find((season) => season.seasonNumber === seasonNumber)?.episodes ?? [])
    .map((episode) => episode.episodeNumber)
    .filter((number): number is number => number !== null && number !== undefined);

/**
 * Works out what a programme is missing, preferring the catalogue's own shape where one is known —
 * which is the only way to tell a season that ends at episode nine from one missing its tenth. With
 * no catalogue to ask, absence is only reported between the episodes actually held, since nothing
 * else can be known from the files alone.
 *
 * @param show - The programme as Valence holds it, with the catalogue's shape when one was fetched.
 * @returns The missing seasons, the missing episodes by season, and whether a catalogue said so.
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
