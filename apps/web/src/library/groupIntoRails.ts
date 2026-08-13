import { isWorthResuming } from '@FluxContracts/schemas/WatchProgress';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

type Rail = {
  /**
   * Stable across renders, so React keeps a row's scroll position when the
   * library around it changes.
   */
  id: string;
  title: string;
  items: MediaSummary[];
  /**
   * An episode of the series this row is of, for a row whose heading names a
   * programme rather than a mood. A viewer who reads "A Sign of Affection" and
   * presses it means the programme, so the heading has to know which one it is
   * talking about. Absent on rows like `Continue watching`, which are about no
   * one series.
   */
  showOf?: MediaSummary;
};

/**
 * How many items a row shows before it is just a list again.
 */
const RAIL_LIMIT = 24;

/**
 * How many episodes a programme's own row shows.
 *
 * Higher than the rest, because this row is a whole programme across every
 * season it has rather than a handful of picks, and a long-running one cut off
 * two dozen in would stop partway through its second year. Still a limit: past
 * this the row is a chore to scroll and the programme's own page is the place
 * to be.
 */
const SERIES_RAIL_LIMIT = 60;

/**
 * The fewest episodes worth a row of their own.
 *
 * One episode of something is not a season, and a row containing a single card
 * looks like a mistake.
 */
const MIN_SERIES_ITEMS = 2;

/**
 * How recently something must have arrived to count as new.
 */
const RECENT_DAYS = 30;

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
 * By season and then by episode, rather than by title: `Episode 10` sorts
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
 * Sorts a library into the rows it is browsed by.
 *
 * A library is not one list, it is several: what arrived recently, each season
 * of each series, and everything else. Rows rather than a grid because that is
 * how someone browses when they do not already know what they want.
 *
 * Nothing here invents a row it cannot fill. Continue watching appears only
 * once there is something to continue, because a row that is always empty
 * teaches people to ignore rows.
 */
const groupIntoRails = (
  items: MediaSummary[],
  now = Date.now(),
  progress: Map<string, WatchProgress> = new Map(),
): Rail[] => {
  if (items.length === 0) {
    return [];
  }

  const rails: Rail[] = [];

  const resuming = items
    .filter((media) => {
      const found = progress.get(media.id);

      return found !== undefined && isWorthResuming(found);
    })
    .sort((left, right) => {
      const leftAt = Date.parse(progress.get(left.id)?.updatedAt ?? '');
      const rightAt = Date.parse(progress.get(right.id)?.updatedAt ?? '');

      return (Number.isNaN(rightAt) ? 0 : rightAt) - (Number.isNaN(leftAt) ? 0 : leftAt);
    })
    .slice(0, RAIL_LIMIT);

  if (resuming.length > 0) {
    rails.push({ id: 'resume', title: 'Continue watching', items: resuming });
  }
  const recentThreshold = now - RECENT_DAYS * 24 * 60 * 60 * 1000;

  const seenSeries = new Set<string>();

  const recent = [...items]
    .filter((media) => addedAtMs(media) >= recentThreshold)
    .sort((left, right) => addedAtMs(right) - addedAtMs(left))
    .filter((media) => {
      const series = media.seriesTitle ?? '';

      if (series === '') {
        return true;
      }

      const named = series.toLowerCase();

      if (seenSeries.has(named)) {
        return false;
      }

      seenSeries.add(named);

      return true;
    })
    .slice(0, RAIL_LIMIT);

  if (recent.length > 0) {
    rails.push({ id: 'recent', title: 'Recently added', items: recent });
  }

  const series = new Map<string, MediaSummary[]>();
  const films: MediaSummary[] = [];

  for (const media of items) {
    if (media.seriesTitle === null || media.seriesTitle === undefined || media.seriesTitle === '') {
      films.push(media);

      continue;
    }

    const key = media.seriesTitle.toLowerCase();

    series.set(key, [...(series.get(key) ?? []), media]);
  }

  for (const [key, episodes] of series) {
    if (episodes.length < MIN_SERIES_ITEMS) {
      films.push(...episodes);

      continue;
    }

    const inOrder = [...episodes].sort(inBroadcastOrder);
    const first = inOrder[0];

    if (first?.seriesTitle === null || first?.seriesTitle === undefined) {
      continue;
    }

    rails.push({
      id: `series:${key}`,
      title: first.seriesTitle,
      items: inOrder.slice(0, SERIES_RAIL_LIMIT),
      showOf: first,
    });
  }

  if (films.length > 0) {
    rails.push({
      id: 'everything',
      title: rails.length === 0 ? 'Everything' : 'Films',
      items: [...films].sort((left, right) => left.title.localeCompare(right.title)),
    });
  }

  return rails;
};

export type { Rail };

export { groupIntoRails, inBroadcastOrder, RAIL_LIMIT, MIN_SERIES_ITEMS, RECENT_DAYS };
