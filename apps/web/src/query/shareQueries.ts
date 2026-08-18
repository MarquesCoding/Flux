import { queryOptions } from '@tanstack/react-query';
import { fetchShares } from '@FluxWeb/sharing/fetchShares';

const SHARES = ['shares'] as const;

/**
 * The links this account has handed out, and how far each has been used.
 *
 * Withdrawing one invalidates this key rather than refetching from the panel, so that anything else
 * showing a link hears about it too.
 *
 * @returns The query.
 */
const mine = () =>
  queryOptions({
    queryKey: [...SHARES, 'mine'],
    queryFn: () => fetchShares(),
  });

const shareQueries = { mine, key: SHARES };

export { shareQueries };
