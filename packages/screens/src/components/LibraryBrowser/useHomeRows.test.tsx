import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressScope } from '@ValenceScreens/testing/AddressScope';
import { shellContext } from '@ValenceClient/shell/shellContext';
import { aShell } from '@ValenceClient/testing/aShell';
import { useHomeRows } from './useHomeRows';
import type { ReactNode } from 'react';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { WatchProgress } from '@ValenceContracts/schemas/WatchProgress';

const { itemsMock, facetsMock, favouritesMock, ratingsMock } = vi.hoisted(() => ({
  itemsMock: vi.fn(),
  facetsMock: vi.fn(),
  favouritesMock: vi.fn(),
  ratingsMock: vi.fn(),
}));

vi.mock('@ValenceClient/library/fetchLibrary', () => ({ fetchLibraryItems: itemsMock }));
vi.mock('@ValenceClient/library/fetchFacets', () => ({ fetchFacets: facetsMock }));
vi.mock('@ValenceClient/library/fetchFavourites', () => ({
  fetchFavourites: favouritesMock,
  setFavourite: vi.fn(),
}));
vi.mock('@ValenceClient/library/fetchRatings', () => ({
  fetchRatings: ratingsMock,
  fetchHouseholdRating: vi.fn(),
  setRating: vi.fn(),
}));

const LIBRARY = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * A film, in the genres given.
 */
const film = (id: string, genres: string[] = [], rating = 7): MediaSummary => ({
  id,
  libraryId: LIBRARY,
  title: id,
  year: 2020,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  genres,
  rating,
});

/**
 * As many films as asked for, all in the one genre.
 */
const films = (prefix: string, count: number, genre = prefix): MediaSummary[] =>
  Array.from({ length: count }, (_, at) => film(`${prefix}-${at.toString()}`, [genre]));

/**
 * Somebody half-way through a film.
 */
const halfWay = (mediaId: string): WatchProgress => ({
  mediaId,
  positionSeconds: 3600,
  durationSeconds: 7200,
  isFinished: false,
  updatedAt: '2026-09-01T00:00:00.000Z',
});

/**
 * Draws the hook inside the shell and at an address, as the page it serves is drawn.
 */
const inTheShell = ({ children }: { children: ReactNode }) => (
  <AddressScope>
    <shellContext.Provider value={aShell()}>{children}</shellContext.Provider>
  </AddressScope>
);

/**
 * A library that answers each question the rows ask with the films given for it.
 */
const aLibrary = (answers: {
  recent?: MediaSummary[];
  acclaimed?: MediaSummary[];
  byGenre?: Record<string, MediaSummary[]>;
  byId?: MediaSummary[];
}) => {
  itemsMock.mockImplementation(
    (
      _libraryId: string,
      options: { order?: string; minRating?: number; genre?: string; ids?: string[] },
    ) => {
      const items =
        options.ids !== undefined
          ? (answers.byId ?? []).filter((media) => options.ids?.includes(media.id) === true)
          : options.genre !== undefined
            ? (answers.byGenre?.[options.genre] ?? [])
            : options.minRating !== undefined
              ? (answers.acclaimed ?? [])
              : (answers.recent ?? []);

      return Promise.resolve({ items, total: items.length });
    },
  );
};

beforeEach(() => {
  itemsMock.mockReset();
  facetsMock.mockReset();
  favouritesMock.mockReset();
  ratingsMock.mockReset();

  facetsMock.mockResolvedValue({ genres: [], decades: [], maxRating: 10 });
  favouritesMock.mockResolvedValue([]);
  ratingsMock.mockResolvedValue([]);
  aLibrary({});
});

describe('useHomeRows', () => {
  it('asks for nothing while somebody is searching, since the rows are not wanted then', async () => {
    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), false, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.isReading).toBe(false);
    });

    expect(itemsMock).not.toHaveBeenCalled();
    expect(result.current.rails).toEqual([]);
  });

  it('lays the rows out as carrying on, suggested, new, acclaimed, and then genres', async () => {
    const watching = film('watching', ['Drama']);

    facetsMock.mockResolvedValue({ genres: ['Comedy', 'Drama'], decades: [], maxRating: 10 });
    aLibrary({
      recent: films('new', 5, 'Comedy'),
      acclaimed: films('great', 5, 'Comedy'),
      byGenre: { Drama: films('drama', 5, 'Drama'), Comedy: films('comedy', 5, 'Comedy') },
      byId: [watching],
    });

    const { result } = renderHook(
      () => useHomeRows([LIBRARY], new Map([['watching', halfWay('watching')]]), true, true),
      { wrapper: inTheShell },
    );

    await waitFor(() => {
      expect(result.current.rails.map((rail) => rail.id)).toEqual([
        'resume',
        'picked',
        'recent',
        'acclaimed',
        'genre:Drama',
        'genre:Comedy',
      ]);
    });
  });

  it('asks the genres somebody leans towards for first', async () => {
    facetsMock.mockResolvedValue({ genres: ['Comedy', 'Drama'], decades: [], maxRating: 10 });
    favouritesMock.mockResolvedValue(['kept']);
    aLibrary({
      byGenre: { Drama: films('drama', 5, 'Drama'), Comedy: films('comedy', 5, 'Comedy') },
      byId: [film('kept', ['Drama'])],
    });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.rails.map((rail) => rail.id)).toEqual([
        'picked',
        'genre:Drama',
        'genre:Comedy',
      ]);
    });
  });

  it('suggests nothing somebody has already watched or kept', async () => {
    facetsMock.mockResolvedValue({ genres: ['Drama'], decades: [], maxRating: 10 });
    favouritesMock.mockResolvedValue(['drama-0']);
    aLibrary({
      byGenre: { Drama: films('drama', 8, 'Drama') },
      byId: [film('drama-0', ['Drama'])],
    });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.rails.find((rail) => rail.id === 'picked')).toBeDefined();
    });

    const picked = result.current.rails.find((rail) => rail.id === 'picked');

    expect(picked?.items.map((media) => media.id)).not.toContain('drama-0');
  });

  it('keeps every row to a bounded number of things however much there is', async () => {
    aLibrary({ recent: films('new', 30, 'Comedy') });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.rails.find((rail) => rail.id === 'recent')?.items).toHaveLength(20);
    });
  });

  it('asks the server for a handful of things per row rather than the whole library', async () => {
    renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), { wrapper: inTheShell });

    await waitFor(() => {
      expect(itemsMock).toHaveBeenCalledWith(
        LIBRARY,
        expect.objectContaining({ order: 'newest', limit: 20 }),
      );
    });

    expect(itemsMock).toHaveBeenCalledWith(
      LIBRARY,
      expect.objectContaining({ minRating: 7.5, limit: 20 }),
    );
  });

  it('asks for a handful of genres first, and the rest a few at a time when told', async () => {
    const genres = Array.from({ length: 9 }, (_, at) => `Genre ${at.toString()}`);

    facetsMock.mockResolvedValue({ genres, decades: [], maxRating: 10 });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(itemsMock).toHaveBeenCalledWith(
        LIBRARY,
        expect.objectContaining({ genre: 'Genre 5' }),
      );
    });

    expect(itemsMock).not.toHaveBeenCalledWith(
      LIBRARY,
      expect.objectContaining({ genre: 'Genre 6' }),
    );
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.showMore();
    });

    await waitFor(() => {
      expect(itemsMock).toHaveBeenCalledWith(
        LIBRARY,
        expect.objectContaining({ genre: 'Genre 8' }),
      );
    });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('offers the decades once the genres have run out', async () => {
    facetsMock.mockResolvedValue({ genres: ['Drama'], decades: [2020], maxRating: 10 });
    aLibrary({
      recent: films('new', 5, 'Comedy'),
      byGenre: { Drama: films('drama', 5, 'Drama') },
    });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.rails.some((rail) => rail.id === 'genre:Drama')).toBe(true);
    });

    act(() => {
      result.current.showMore();
    });

    await waitFor(() => {
      expect(itemsMock).toHaveBeenCalledWith(
        LIBRARY,
        expect.objectContaining({ yearFrom: 2020, yearTo: 2029 }),
      );
    });
  });

  it('goes on offering rows after the decades, so the page never simply stops', async () => {
    facetsMock.mockResolvedValue({ genres: ['Drama'], decades: [], maxRating: 10 });
    aLibrary({ byGenre: { Drama: films('drama', 5, 'Drama') } });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.rails.some((rail) => rail.id === 'genre:Drama')).toBe(true);
    });

    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.showMore();
    });

    await waitFor(() => {
      expect(itemsMock).toHaveBeenCalledWith(
        LIBRARY,
        expect.objectContaining({ genre: 'Drama', order: 'newest' }),
      );
    });
  });

  it('asks for nothing more where no row was worth showing in the first place', async () => {
    facetsMock.mockResolvedValue({ genres: ['Drama'], decades: [], maxRating: 10 });
    aLibrary({ byGenre: { Drama: films('drama', 2, 'Drama') } });

    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    await waitFor(() => {
      expect(result.current.isReading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('says it is still reading until the first rows have arrived', async () => {
    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, true), {
      wrapper: inTheShell,
    });

    expect(result.current.isReading).toBe(true);

    await waitFor(() => {
      expect(result.current.isReading).toBe(false);
    });
  });

  it('waits for what somebody has watched before choosing what to offer them', () => {
    const { result } = renderHook(() => useHomeRows([LIBRARY], new Map(), true, false), {
      wrapper: inTheShell,
    });

    expect(result.current.isReading).toBe(true);
    expect(itemsMock).not.toHaveBeenCalledWith(LIBRARY, expect.objectContaining({ ids: [] }));
  });
});
