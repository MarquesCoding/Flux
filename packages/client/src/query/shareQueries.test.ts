import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareQueries } from './shareQueries';

const fetchShares = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/sharing/fetchShares', () => ({ fetchShares }));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();

  fetchShares.mockResolvedValue([]);
});

describe('shareQueries', () => {
  it('asks for the links this account has handed out', async () => {
    await expect(aCache().fetchQuery(shareQueries.mine())).resolves.toEqual([]);
  });

  it('sits under its own key rather than the administrator’s, since it reads one account', () => {
    expect(shareQueries.mine().queryKey.slice(0, 1)).toEqual(shareQueries.key);
  });
});
