import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import { formatBytes } from '@FluxCore/functions/formatBytes';

type CacheRow = {
  label: string;
  value: string;
  detail: string;
  hint?: string;
};

/**
 * Says how many of something there are without saying "1 items".
 */
const counted = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${count.toString()} ${many}`;

/**
 * What is on the disk, a kind at a time.
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
export type { CacheRow };
