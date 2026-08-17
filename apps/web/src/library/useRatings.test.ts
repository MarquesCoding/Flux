import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRatings } from './useRatings';
import type { Rating } from '@FluxContracts/schemas/Rating';
import type { RatingSubject } from '@FluxWeb/library/fetchRatings';

const fetchRatings = vi.fn<() => Promise<Rating[]>>();
const setRating = vi.fn<(subject: RatingSubject, stars: number | null) => Promise<boolean>>();

vi.mock('@FluxWeb/library/fetchRatings', () => ({
  fetchRatings: () => fetchRatings(),
  setRating: (subject: RatingSubject, stars: number | null) => setRating(subject, stars),
}));

const RATED = (over: Partial<Rating> = {}): Rating => ({
  mediaId: 'media-1',
  seriesId: null,
  stars: 4,
  ratedAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  fetchRatings.mockReset().mockResolvedValue([]);
  setRating.mockReset().mockResolvedValue(true);
});

describe('useRatings', () => {
  it('reads the whole list once rather than asking per item', async () => {
    fetchRatings.mockResolvedValue([RATED()]);

    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(4);
    });
    expect(fetchRatings).toHaveBeenCalledTimes(1);
  });

  it('does not show one person their stars against somebody else', async () => {
    fetchRatings.mockResolvedValue([RATED({ stars: 3 })]);

    const { result, rerender } = renderHook(({ who }: { who: string }) => useRatings(who), {
      initialProps: { who: 'dan' },
    });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(3);
    });

    fetchRatings.mockResolvedValue([]);
    rerender({ who: 'jeff' });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBeNull();
    });
    expect(fetchRatings).toHaveBeenCalledTimes(2);
  });

  it('does not carry an unsent change across to the next person', async () => {
    fetchRatings.mockResolvedValue([]);

    const { result, rerender } = renderHook(({ who }: { who: string }) => useRatings(who), {
      initialProps: { who: 'dan' },
    });

    await waitFor(() => {
      expect(fetchRatings).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.rate({ mediaId: 'media-1' }, 5);
    });

    rerender({ who: 'jeff' });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBeNull();
    });
  });

  it('has nothing for something nobody rated', async () => {
    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBeNull();
    });
  });

  it('keeps an item and a programme of the same identifier apart', async () => {
    fetchRatings.mockResolvedValue([
      RATED({ mediaId: 'same', seriesId: null, stars: 4 }),
      RATED({ mediaId: null, seriesId: 'same', stars: 2 }),
    ]);

    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'same' })).toBe(4);
    });
    expect(result.current.ratingFor({ seriesId: 'same' })).toBe(2);
  });

  it('fills the star before the server has answered', async () => {
    let answer = (agreed: boolean) => {
      void agreed;
    };

    setRating.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );

    const { result } = renderHook(() => useRatings('watcher-1'));

    await act(async () => {
      result.current.rate({ mediaId: 'media-1' }, 5);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(5);
    });

    await act(async () => {
      answer(true);
      await Promise.resolve();
    });

    expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(5);
  });

  it('puts the star back where it was when the server disagrees', async () => {
    fetchRatings.mockResolvedValue([RATED({ stars: 3 })]);
    setRating.mockResolvedValue(false);

    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(3);
    });

    await act(async () => {
      result.current.rate({ mediaId: 'media-1' }, 5);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(3);
    });
  });

  it('takes a rating back', async () => {
    fetchRatings.mockResolvedValue([RATED()]);

    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(4);
    });

    await act(async () => {
      result.current.rate({ mediaId: 'media-1' }, null);
      await Promise.resolve();
    });

    expect(result.current.ratingFor({ mediaId: 'media-1' })).toBeNull();
    expect(setRating).toHaveBeenCalledWith({ mediaId: 'media-1' }, null);
  });

  it('restores a rating the server refused to take back', async () => {
    fetchRatings.mockResolvedValue([RATED()]);
    setRating.mockResolvedValue(false);

    const { result } = renderHook(() => useRatings('watcher-1'));

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(4);
    });

    await act(async () => {
      result.current.rate({ mediaId: 'media-1' }, null);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.ratingFor({ mediaId: 'media-1' })).toBe(4);
    });
  });

  it('rates a programme at its own key', async () => {
    const { result } = renderHook(() => useRatings('watcher-1'));

    await act(async () => {
      result.current.rate({ seriesId: 'show-1' }, 5);
      await Promise.resolve();
    });

    expect(result.current.ratingFor({ seriesId: 'show-1' })).toBe(5);
    expect(setRating).toHaveBeenCalledWith({ seriesId: 'show-1' }, 5);
  });
});
