import { addedAtMs } from '@FluxCore/functions/addedAtMs';
import { inBroadcastOrder } from '@FluxCore/functions/inBroadcastOrder';
import { isWorthResuming } from '@FluxContracts/schemas/WatchProgress';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

type Rail = {
  id: string;
  title: string;
  items: MediaSummary[];
  showOf?: MediaSummary;
};

const RAIL_LIMIT = 24;

const SERIES_RAIL_LIMIT = 60;

const MIN_SERIES_ITEMS = 2;

const RECENT_DAYS = 30;

/**
 * Sorts a library into the rows it is browsed by.
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
    .filter((media) => addedAtMs(media.addedAt) >= recentThreshold)
    .sort((left, right) => addedAtMs(right.addedAt) - addedAtMs(left.addedAt))
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

export { groupIntoRails, inBroadcastOrder };
