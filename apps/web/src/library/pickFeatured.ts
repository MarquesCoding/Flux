import type { MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * Which item stands for a show.
 *
 * The earliest episode there is: somebody meeting a series on a home page is
 * being introduced to it, and being introduced at episode nine is no
 * introduction at all.
 */
const isEarlier = (candidate: MediaSummary, against: MediaSummary): boolean => {
  const season = (candidate.seasonNumber ?? 0) - (against.seasonNumber ?? 0);

  return season === 0 ? (candidate.episodeNumber ?? 0) < (against.episodeNumber ?? 0) : season < 0;
};

/**
 * One card per thing, rather than one per file.
 *
 * A library of twelve episodes is one programme, and a page that draws it as
 * twelve tiles is a page nobody can find anything on — the same picture, the
 * same name, twelve times, with the actual variety pushed off the screen.
 * Films stand for themselves, since there is nothing to group them under.
 *
 * The earliest episode stands in for the series: somebody meeting a
 * programme on a page is being introduced to it, and being introduced at
 * episode nine is no introduction. The card already reads the series title
 * off it, so what shows is the programme rather than that episode.
 *
 * Grouped by `seriesId` where there is one, falling back to the title. Two
 * programmes share a title — The Office, Shameless, and every remake — so
 * grouping on the title alone quietly merges them into one card.
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
 * The items worth putting on the front of a library.
 *
 * The same collapsing every page does, cut to what a hero can rotate
 * through.
 */
const pickFeatured = (items: MediaSummary[], limit: number): MediaSummary[] =>
  collapseToShows(items).slice(0, limit);

/**
 * The other episodes of the same season.
 *
 * In broadcast order and without the one being read about, because a list of
 * what to watch next that includes what is already open is a list with a hole
 * in it.
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
 * What follows an episode.
 *
 * The next one in the same season, and nothing at all for a film or for the
 * last episode there is. A season that runs on into whatever happened to be
 * listed next would be worse than stopping.
 */
const nextEpisode = (items: MediaSummary[], after: MediaSummary): MediaSummary | null => {
  const at = after.episodeNumber ?? null;

  if (at === null) {
    return null;
  }

  return findSiblings(items, after).find((item) => (item.episodeNumber ?? 0) > at) ?? null;
};

export { collapseToShows, pickFeatured, isEarlier, findSiblings, nextEpisode };
