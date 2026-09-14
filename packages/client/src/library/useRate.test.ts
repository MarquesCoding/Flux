import { act, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookInACache } from '@ValenceClient/testing/renderHookInACache';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { useRate } from './useRate';
import type { Rating } from '@ValenceContracts/schemas/Rating';

const setRating = vi.fn<() => Promise<boolean>>();

vi.mock('@ValenceClient/library/fetchRatings', () => ({
  setRating: () => setRating(),
  fetchRatings: () => Promise.resolve([]),
  fetchHouseholdRating: () => Promise.resolve({ average: null, count: 0 }),
}));

const WATCHER = 'usr_1';

const ARRIVAL = '9c858901-8a57-4791-81fe-4c455b099bc9';

const held = (cache: ReturnType<typeof useQueryClient>): Rating[] =>
  cache.getQueryData(viewingQueries.ratings(WATCHER).queryKey) ?? [];

beforeEach(() => {
  setRating.mockReset().mockResolvedValue(true);
});

describe('useRate', () => {
  it('writes the star to the cache before the server has answered', () => {
    const { result } = renderHookInACache(() => ({
      rate: useRate(WATCHER),
      cache: useQueryClient(),
    }));

    act(() => {
      result.current.rate({ mediaId: ARRIVAL }, 4);
    });

    expect(held(result.current.cache)).toEqual([
      expect.objectContaining({ mediaId: ARRIVAL, stars: 4 }),
    ]);
  });

  it('puts the star back where the server refused it', async () => {
    setRating.mockResolvedValue(false);

    const { result } = renderHookInACache(() => ({
      rate: useRate(WATCHER),
      cache: useQueryClient(),
    }));

    act(() => {
      result.current.rate({ mediaId: ARRIVAL }, 4);
    });

    await waitFor(() => {
      expect(held(result.current.cache)).toEqual([]);
    });
  });

  it('takes a rating back when nothing is given', () => {
    const { result } = renderHookInACache(() => ({
      rate: useRate(WATCHER),
      cache: useQueryClient(),
    }));

    act(() => {
      result.current.rate({ mediaId: ARRIVAL }, 4);
    });

    act(() => {
      result.current.rate({ mediaId: ARRIVAL }, null);
    });

    expect(held(result.current.cache)).toEqual([]);
  });

  it('redraws nobody, which is the whole reason it holds no query', () => {
    let drawn = 0;

    const { result } = renderHookInACache(() => {
      drawn += 1;

      return { rate: useRate(WATCHER), cache: useQueryClient() };
    });

    const before = drawn;

    act(() => {
      result.current.rate({ mediaId: ARRIVAL }, 5);
    });

    expect(drawn).toBe(before);
  });

  it('hands back the same gesture each time, so nothing below it redraws either', () => {
    const { result, rerender } = renderHookInACache(() => useRate(WATCHER));

    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
