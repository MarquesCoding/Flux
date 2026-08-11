import { showSlug } from '@FluxCore/functions/showSlug';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show';

/**
 * Reads a timestamp, treating anything unreadable as long ago.
 */
const addedAtMs = (media: MediaSummary): number => {
  const parsed = Date.parse(media.addedAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Orders episodes the way they are watched.
 *
 * By season and then by episode rather than by title: `Episode 10` sorts
 * before `Episode 2` alphabetically, which is no use to anyone.
 */
const inBroadcastOrder = (left: MediaSummary, right: MediaSummary): number => {
  const season = (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0);

  if (season !== 0) {
    return season;
  }

  const episode = (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0);

  return episode === 0 ? left.title.localeCompare(right.title) : episode;
};

/**
 * Everything that names the same series, gathered.
 *
 * Items that name no series are not shows and are left where they were: a film
 * is not a series of one.
 */
const gather = (items: MediaSummary[]): Map<string, MediaSummary[]> => {
  const shows = new Map<string, MediaSummary[]>();

  for (const media of items) {
    const series = media.seriesTitle ?? '';

    if (series === '') {
      continue;
    }

    const id = showSlug(series);

    shows.set(id, [...(shows.get(id) ?? []), media]);
  }

  return shows;
};

/**
 * What a series is, said from what its episodes agree on.
 *
 * The cover is the first episode in broadcast order rather than the newest:
 * the picture that stands for a series should be the one that opens it, and
 * anyone meeting a show for the first time is offered episode one.
 *
 * The year, the rating and the genres are taken from whichever episode carries
 * them. A catalogue describes a series once, and every episode of it repeats
 * that description, so the first that has one is as good as any.
 */
const describeShow = (id: string, episodes: MediaSummary[]): ShowSummary | null => {
  const inOrder = [...episodes].sort(inBroadcastOrder);
  const cover = inOrder[0];

  if (cover?.seriesTitle === null || cover?.seriesTitle === undefined) {
    return null;
  }

  const seasons = new Set(inOrder.map((episode) => episode.seasonNumber ?? 0));

  return {
    id,
    libraryId: cover.libraryId,
    title: cover.seriesTitle,
    seasonCount: seasons.size,
    episodeCount: inOrder.length,
    latestAddedAt: new Date(
      Math.max(...inOrder.map((episode) => addedAtMs(episode))),
    ).toISOString(),
    coverMediaId: cover.id,
    year: inOrder.find((episode) => episode.year !== null)?.year ?? null,
    rating: inOrder.find((episode) => (episode.rating ?? null) !== null)?.rating ?? null,
    genres: inOrder.find((episode) => (episode.genres ?? []).length > 0)?.genres ?? [],
  };
};

/**
 * Every series in a set of items, newest arrival first.
 *
 * Ordered by what arrived rather than by name, because a shelf of shows is
 * read for what is new on it.
 */
const groupIntoShows = (items: MediaSummary[]): ShowSummary[] =>
  [...gather(items)]
    .map(([id, episodes]) => describeShow(id, episodes))
    .filter((show): show is ShowSummary => show !== null)
    .sort((left, right) => Date.parse(right.latestAddedAt) - Date.parse(left.latestAddedAt));

/**
 * One series, with its episodes in the order they are watched.
 *
 * Seasons are whatever the episodes claim to be in, in numerical order, with
 * anything unnumbered last — a special nobody has labelled belongs after the
 * series rather than before it.
 */
const buildShowDetail = (items: MediaSummary[], showId: string): ShowDetail | null => {
  const episodes = gather(items).get(showId);

  if (episodes === undefined) {
    return null;
  }

  const summary = describeShow(showId, episodes);

  if (summary === null) {
    return null;
  }

  const seasons = new Map<number | null, MediaSummary[]>();

  for (const episode of [...episodes].sort(inBroadcastOrder)) {
    const season = episode.seasonNumber ?? null;

    seasons.set(season, [...(seasons.get(season) ?? []), episode]);
  }

  return {
    ...summary,
    seasons: [...seasons]
      .map(([seasonNumber, ofSeason]) => ({ seasonNumber, episodes: ofSeason }))
      .sort((left, right) => (left.seasonNumber ?? Infinity) - (right.seasonNumber ?? Infinity)),
  };
};

export { groupIntoShows, buildShowDetail, describeShow, inBroadcastOrder };
