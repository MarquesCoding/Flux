import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookInACache } from '@ValenceClient/testing/renderHookInACache';
import { useStars } from './useStars';
import type { Rating } from '@ValenceContracts/schemas/Rating';

const fetchRatings = vi.fn<() => Promise<Rating[]>>();

vi.mock('@ValenceClient/library/fetchRatings', () => ({
  fetchRatings: () => fetchRatings(),
  fetchHouseholdRating: () => Promise.resolve({ average: null, count: 0 }),
  setRating: () => Promise.resolve(true),
}));

const WATCHER = 'usr_1';

const ARRIVAL = '9c858901-8a57-4791-81fe-4c455b099bc9';

const TED = '11111111-1111-4111-8111-111111111111';

const rated = (mediaId: string | null, seriesId: string | null, stars: number): Rating => ({
  mediaId,
  seriesId,
  stars,
  ratedAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => {
  fetchRatings.mockReset().mockResolvedValue([]);
});

describe('useStars', () => {
  it('gives back what this viewer gave the thing being shown', async () => {
    fetchRatings.mockResolvedValue([rated(ARRIVAL, null, 4)]);

    const { result } = renderHookInACache(() => useStars(WATCHER, { mediaId: ARRIVAL }));

    await waitFor(() => {
      expect(result.current).toBe(4);
    });
  });

  it('gives back nothing where they have not rated it', async () => {
    fetchRatings.mockResolvedValue([rated(TED, null, 5)]);

    const { result } = renderHookInACache(() => useStars(WATCHER, { mediaId: ARRIVAL }));

    await waitFor(() => {
      expect(fetchRatings).toHaveBeenCalled();
    });

    expect(result.current).toBeNull();
  });

  it('keeps an item and a programme apart where they share an identifier', async () => {
    fetchRatings.mockResolvedValue([rated(null, ARRIVAL, 2)]);

    const { result } = renderHookInACache(() => useStars(WATCHER, { mediaId: ARRIVAL }));

    await waitFor(() => {
      expect(fetchRatings).toHaveBeenCalled();
    });

    expect(result.current).toBeNull();
  });

  it('reads a programme by its own identifier', async () => {
    fetchRatings.mockResolvedValue([rated(null, ARRIVAL, 2)]);

    const { result } = renderHookInACache(() => useStars(WATCHER, { seriesId: ARRIVAL }));

    await waitFor(() => {
      expect(result.current).toBe(2);
    });
  });

  it('asks nothing where nobody is watching', async () => {
    renderHookInACache(() => useStars(null, { mediaId: ARRIVAL }));

    await waitFor(() => {
      expect(fetchRatings).not.toHaveBeenCalled();
    });
  });
});
