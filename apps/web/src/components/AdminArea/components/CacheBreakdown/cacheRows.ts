import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import { formatBytes } from '@FluxWeb/components/AdminArea/formatBytes';

type CacheRow = {
  label: string;
  value: string;
  detail: string;
  /**
   * What somebody needs told about this figure that the figure cannot say.
   *
   * Only where the number is genuinely surprising. A hint beside every row is
   * a row of icons nobody reads.
   */
  hint?: string;
};

/**
 * Says how many of something there are without saying "1 items".
 */
const counted = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${count.toString()} ${many}`;

/**
 * What is on the disk, a kind at a time.
 *
 * Four kinds, and they are not all measured by the same service: previews,
 * scrub sheets and live transcodes belong to the media service, while artwork
 * is fetched and kept by the API server. Either can be missing while the other
 * is known — one of them having just started does not make the cache empty —
 * so a kind nobody has counted yet says so rather than showing nothing.
 *
 * The media library is the odd one out and belongs anyway. It is the only
 * figure here Flux did not create, and it is the first thing an operator of a
 * media server wants to know — so it sits at the end of the row, after the
 * four that Flux is responsible for, rather than being counted among them.
 *
 * Transcode working directories are counted against the sessions actually
 * running, because the two come apart badly: a session that ended without
 * being collected leaves its directory behind, and on a real server almost
 * every directory is one of those. Calling the total "live transcodes" would
 * report sixty gigabytes of abandoned segments as work in progress, which is
 * the opposite of what somebody needs to know about it.
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
