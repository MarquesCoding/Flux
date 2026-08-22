import type { AdminOverview, Monitor } from '@ValenceClient/admin/fetchAdmin';
import { formatBytes } from '@ValenceCore/functions/formatBytes';

type CacheRow = {
  label: string;
  value: string;
  detail: string;
  hint?: string;
};

/**
 * Counts something in words that read properly at one as well as at many, so a row says "1 clip"
 * rather than "1 clips".
 *
 * @param count - How many there are.
 * @param one - What one is called.
 * @param many - What several are called.
 * @returns The count and its noun.
 */
const counted = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${count.toString()} ${many}`;

/**
 * Builds the rows of the disk breakdown, one per kind of thing Valence keeps, each with its size and how
 * many of it there are. Anything not yet counted is shown as still counting rather than as zero —
 * zero is a claim, and the wrong one while a count is in progress.
 *
 * @param cache - What the monitor found on disk, or null while it is still counting.
 * @param artwork - How much artwork has been fetched and kept.
 * @param liveSessions - How many sessions are writing at the moment.
 * @param library - How much the library itself holds, where that has been worked out.
 * @returns The rows to show.
 */
const cacheRows = (
  cache: Monitor['cache'],
  artwork: AdminOverview['artwork'],
  liveSessions: number,
  library: { bytes: number; itemCount: number } | null,
): CacheRow[] => {
  const pending = { value: '—', detail: 'Still counting' };

  return [
    {
      label: 'Preview clips',
      ...(cache === null
        ? pending
        : {
            value: formatBytes(cache.previews.bytes),
            detail: counted(cache.previews.count, 'clip', 'clips'),
          }),
    },
    {
      label: 'Scrub thumbnails',
      ...(cache === null
        ? pending
        : {
            value: formatBytes(cache.trickplay.bytes),
            detail: counted(cache.trickplay.count, 'set', 'sets'),
          }),
    },
    {
      label: 'Transcode sessions',
      hint: 'Files that will not play on a device as they are get converted, and the result is kept so resuming does not convert it again. Each device keeps only the last thing it played. None of this is your media — it rebuilds on demand.',
      ...(cache === null
        ? pending
        : {
            value: formatBytes(cache.sessions.bytes),
            detail:
              cache.sessions.count <= liveSessions
                ? counted(cache.sessions.count, 'running', 'running')
                : `${counted(cache.sessions.count - liveSessions, 'left behind', 'left behind')}`,
          }),
    },
    {
      label: 'Artwork',
      ...(artwork === null
        ? pending
        : {
            value: formatBytes(artwork.bytes),
            detail: counted(artwork.count, 'image', 'images'),
          }),
    },
    {
      label: 'Media library',
      ...(library === null
        ? pending
        : {
            value: formatBytes(library.bytes),
            detail: counted(library.itemCount, 'file', 'files'),
          }),
    },
  ];
};

export { cacheRows };
