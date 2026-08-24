import { queryOptions } from '@tanstack/react-query';
import { fetchDownloads, fetchHoldings } from '@ValenceClient/downloads/fetchDownloads';

const DOWNLOADS = ['downloads'] as const;

const PREPARING_IS_ASKED_ABOUT_EVERY_MS = 3000;

/**
 * Everything this viewer has asked to have prepared.
 *
 * Asked about repeatedly while anything is still being prepared, and left alone once nothing is.
 * A transcode takes minutes, so there is something to watch; when there is not, polling a list that
 * cannot change is work nobody is waiting on.
 *
 * @returns The query.
 */
const all = () =>
  queryOptions({
    queryKey: [...DOWNLOADS, 'all'],
    queryFn: () => fetchDownloads(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((one) => one.state === 'preparing')
        ? PREPARING_IS_ASKED_ABOUT_EVERY_MS
        : false,
  });

/**
 * What this viewer's devices say they are holding.
 *
 * @returns The query.
 */
const holdings = () =>
  queryOptions({
    queryKey: [...DOWNLOADS, 'holdings'],
    queryFn: () => fetchHoldings(),
  });

const downloadQueries = { all, holdings, key: DOWNLOADS };

export { downloadQueries };
