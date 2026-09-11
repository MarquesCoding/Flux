import type { MediaSummary } from '@ValenceContracts/schemas/Library';

/**
 * Decides which of two episodes should stand for a whole programme, preferring the earliest — a
 * shelf shows a series by its first episode rather than by whichever was scanned first.
 *
 * @param candidate - One episode.
 * @param against - The episode to compare it against.
 * @returns Whether the first should stand for the programme.
 */
const isEarlier = (candidate: MediaSummary, against: MediaSummary): boolean => {
  const season = (candidate.seasonNumber ?? 0) - (against.seasonNumber ?? 0);

  return season === 0 ? (candidate.episodeNumber ?? 0) < (against.episodeNumber ?? 0) : season < 0;
};

/**
 * Collapses a list of files into one card per thing: a programme once rather than once per episode.
 * A page holds sixty things, and without this a single series can fill it.
 *
 * @param items - The files as the server listed them.
 * @returns One entry per film and per programme.
 */
const collapseToShows = (items: MediaSummary[]): MediaSummary[] => {
  const shows = new Map<string, MediaSummary>();
  const featured: MediaSummary[] = [];

  for (const item of items) {
    const series = item.seriesId ?? item.seriesTitle ?? null;

    if (series === null) {
      featured.push(item);

      continue;
    }

    const standing = shows.get(series);

    if (standing === undefined) {
      shows.set(series, item);
      featured.push(item);

      continue;
    }

    if (isEarlier(item, standing)) {
      shows.set(series, item);

      const at = featured.indexOf(standing);

      if (at !== -1) {
        featured[at] = item;
      }
    }
  }

  return featured;
};

/**
 * Picks a handful of things to put at the front of a library, at random rather than newest first,
 * so the front of a library is a reason to look around rather than a list of what arrived last.
 *
 * Collapsed before it is shuffled, not after, so that chance is per title rather than per file. A
 * library is mostly episodes, and shuffling files would make a programme with thirteen of them
 * thirteen times likelier to be chosen than a film — the front page would be all series.
 *
 * @param items - Everything the library holds.
 * @param limit - How many to choose.
 * @param random - Where chance comes from, which a test replaces to know what it will get.
 * @returns The items to feature.
 */
const pickFeatured = (
  items: MediaSummary[],
  limit: number,
  random: () => number = Math.random,
): MediaSummary[] => {
  const pool = collapseToShows(items);

  for (let at = pool.length - 1; at > 0; at -= 1) {
    const swap = Math.floor(random() * (at + 1));
    const held = pool[at];
    const other = pool[swap];

    if (held !== undefined && other !== undefined) {
      pool[at] = other;
      pool[swap] = held;
    }
  }

  return pool.slice(0, limit);
};

/**
 * Finds the other episodes of the same season as one episode, which is what the player's episode
 * list is built from.
 *
 * @param items - Everything known about the library.
 * @param of - The episode being watched.
 * @returns Its siblings, in the order they are watched.
 */
const findSiblings = (items: MediaSummary[], of: MediaSummary): MediaSummary[] => {
  const series = of.seriesTitle ?? null;

  if (series === null) {
    return [];
  }

  return items
    .filter(
      (item) =>
        item.id !== of.id &&
        item.seriesTitle === series &&
        (item.seasonNumber ?? null) === (of.seasonNumber ?? null),
    )
    .sort((left, right) => (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0));
};

/**
 * Finds the episode that follows one, for playing on at the end. Answers with nothing at the end of
 * a season rather than wrapping to the beginning.
 *
 * @param items - Everything known about the library.
 * @param after - The episode that just finished.
 * @returns The next episode, or null where there is none.
 */
const nextEpisode = (items: MediaSummary[], after: MediaSummary): MediaSummary | null => {
  const at = after.episodeNumber ?? null;

  if (at === null) {
    return null;
  }

  return findSiblings(items, after).find((item) => (item.episodeNumber ?? 0) > at) ?? null;
};

export { collapseToShows, pickFeatured, isEarlier, findSiblings, nextEpisode };
