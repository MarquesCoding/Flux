import { addedAtMs } from '@FluxCore/functions/addedAtMs';
import { inBroadcastOrder } from '@FluxCore/functions/inBroadcastOrder';
import { showSlug } from '@FluxCore/functions/showSlug';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show';

/**
 * Gathers every item belonging to the same programme, keyed by the series identifier where a
 * catalogue gave one and by the title where it did not — two programmes share a title often enough
 * that an identifier is used wherever there is one.
 *
 * @param items - Every item in a library.
 * @returns The episodes of each programme, grouped.
 */
const gather = (items: MediaSummary[]): Map<string, MediaSummary[]> => {
  const shows = new Map<string, MediaSummary[]>();

  for (const media of items) {
    const series = media.seriesTitle ?? '';

    if (series === '') {
      continue;
    }

    const id = media.seriesId ?? showSlug(series);

    shows.set(id, [...(shows.get(id) ?? []), media]);
  }

  return shows;
};

/**
 * Describes a programme from what its episodes agree on: its title, how many there are, when the
 * most recent arrived, and which episode's artwork should stand for the whole thing. A programme is
 * not stored anywhere, so everything about it is derived from the files that belong to it.
 *
 * @param id - What identifies the programme, which is derived rather than stored.
 * @param episodes - Every episode of the one programme.
 * @returns What to show for the programme itself.
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
      Math.max(...inOrder.map((episode) => addedAtMs(episode.addedAt))),
    ).toISOString(),
    coverMediaId: cover.id,
    year: inOrder.find((episode) => episode.year !== null)?.year ?? null,
    rating: inOrder.find((episode) => (episode.rating ?? null) !== null)?.rating ?? null,
    genres: inOrder.find((episode) => (episode.genres ?? []).length > 0)?.genres ?? [],
  };
};

/**
 * Groups a library's items into the programmes they belong to, newest arrival first. Done on the
 * server rather than in a browser because a page holds the first sixty things it was sent, and a
 * programme with ninety episodes would otherwise report itself as having thirty.
 *
 * @param items - Every item in a library.
 * @returns One entry per programme, most recently added first.
 */
const groupIntoShows = (items: MediaSummary[]): ShowSummary[] =>
  [...gather(items)]
    .map(([id, episodes]) => describeShow(id, episodes))
    .filter((show): show is ShowSummary => show !== null)
    .sort((left, right) => Date.parse(right.latestAddedAt) - Date.parse(left.latestAddedAt));

/**
 * Builds one programme in full, with its episodes in the order they are watched rather than the
 * order they were scanned.
 *
 * @param items - Every item in the library, of which the programme's are picked out.
 * @param showId - Which programme to build.
 * @returns The programme and its episodes, or null where no item belongs to it.
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

export { groupIntoShows, buildShowDetail, inBroadcastOrder };
