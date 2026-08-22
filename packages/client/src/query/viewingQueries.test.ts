import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { viewingQueries } from './viewingQueries';

const fetchWatchProgress = vi.hoisted(() => vi.fn());
const fetchFavourites = vi.hoisted(() => vi.fn());
const fetchRatings = vi.hoisted(() => vi.fn());
const fetchHouseholdRating = vi.hoisted(() => vi.fn());
const fetchHistory = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/playback/watchProgress', () => ({ fetchWatchProgress }));
vi.mock('@ValenceClient/library/fetchFavourites', () => ({ fetchFavourites }));
vi.mock('@ValenceClient/library/fetchRatings', () => ({ fetchRatings, fetchHouseholdRating }));
vi.mock('@ValenceClient/history/fetchHistory', () => ({ fetchHistory, A_PAGE: 2 }));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const aViewing = (id: string) => ({ id });

beforeEach(() => {
  vi.clearAllMocks();

  fetchWatchProgress.mockResolvedValue([{ mediaId: 'arrival' }]);
  fetchFavourites.mockResolvedValue(['arrival']);
  fetchRatings.mockResolvedValue([{ mediaId: 'arrival', stars: 4 }]);
  fetchHouseholdRating.mockResolvedValue({ average: 4, count: 1 });
  fetchHistory.mockResolvedValue([aViewing('one'), aViewing('two')]);
});

describe('viewingQueries', () => {
  it('asks how far through everything this viewer is, without asking whose it is', async () => {
    await expect(aCache().fetchQuery(viewingQueries.progress())).resolves.toEqual([
      { mediaId: 'arrival' },
    ]);

    expect(viewingQueries.progress().queryKey).toEqual(['viewing', 'progress']);
  });

  it('asks for what somebody kept and what they gave stars to', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(viewingQueries.favourites('watcher'))).resolves.toEqual([
      'arrival',
    ]);

    await expect(cache.fetchQuery(viewingQueries.ratings('watcher'))).resolves.toEqual([
      { mediaId: 'arrival', stars: 4 },
    ]);
  });

  it('asks nothing where nobody is watching', () => {
    expect(viewingQueries.favourites(null).enabled).toBe(false);
    expect(viewingQueries.ratings(null).enabled).toBe(false);
    expect(viewingQueries.household(null).enabled).toBe(false);
  });

  it('asks what the household gave one thing', async () => {
    await expect(
      aCache().fetchQuery(viewingQueries.household({ mediaId: 'arrival' })),
    ).resolves.toEqual({ average: 4, count: 1 });
  });

  it('reads the history a page at a time, from where the last page ended', async () => {
    const held = await aCache().fetchInfiniteQuery({ ...viewingQueries.history(), pages: 2 });

    expect(held.pages).toHaveLength(2);
    expect(fetchHistory).toHaveBeenNthCalledWith(1, 0);
    expect(fetchHistory).toHaveBeenNthCalledWith(2, 2);
  });

  it('stops asking for more once a page came back short', async () => {
    fetchHistory.mockResolvedValue([aViewing('one')]);

    const held = await aCache().fetchInfiniteQuery({ ...viewingQueries.history(), pages: 3 });

    expect(held.pages).toHaveLength(1);
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });
});
