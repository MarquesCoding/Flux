import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAnything } from './pickAnything';
import type { MediaSummary, LibraryKind } from '@FluxContracts/schemas/Library';
import type { ShowSummary } from '@FluxContracts/schemas/Show';

type Page = { items: MediaSummary[]; total: number };

const fetchLibraries = vi.fn<() => Promise<{ id: string; kind: LibraryKind }[]>>();
const fetchLibraryItems =
  vi.fn<(libraryId: string, options?: { limit?: number; offset?: number }) => Promise<Page>>();
const fetchShows = vi.fn<(libraryId: string) => Promise<ShowSummary[]>>();

vi.mock('@FluxClient/library/fetchLibrary', () => ({
  fetchLibraries: () => fetchLibraries(),
  fetchLibraryItems: (libraryId: string, options?: { limit?: number; offset?: number }) =>
    fetchLibraryItems(libraryId, options),
}));

vi.mock('@FluxClient/library/fetchShows', () => ({
  fetchShows: (libraryId: string) => fetchShows(libraryId),
}));

const item = (id: string): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title: id,
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
});

const show = (id: string, episodeCount = 1): ShowSummary => ({
  id,
  libraryId: 'shows-1',
  title: id,
  seasonCount: 1,
  episodeCount,
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  seriesId: null,
});

beforeEach(() => {
  fetchLibraries.mockReset();
  fetchLibraryItems.mockReset();
  fetchShows.mockReset();
  fetchShows.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pickAnything', () => {
  it('asks for one item from somewhere inside a films library', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'library-1', kind: 'movies' }]);
    fetchLibraryItems
      .mockResolvedValueOnce({ items: [item('a')], total: 40 })
      .mockResolvedValueOnce({ items: [item('b')], total: 40 });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await expect(pickAnything()).resolves.toEqual({ kind: 'item', item: item('b') });
    expect(fetchLibraryItems).toHaveBeenLastCalledWith('library-1', { limit: 1, offset: 20 });
  });

  it('gives a large shelf its share of the chances', async () => {
    fetchLibraries.mockResolvedValue([
      { id: 'small', kind: 'movies' },
      { id: 'large', kind: 'movies' },
    ]);
    fetchLibraryItems.mockImplementation((libraryId: string) =>
      Promise.resolve({ items: [item(libraryId)], total: libraryId === 'small' ? 1 : 99 }),
    );
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await expect(pickAnything()).resolves.toMatchObject({ item: { id: 'large' } });
  });

  it('lands on a programme rather than on one of its episodes', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'shows-1', kind: 'shows' }]);
    fetchShows.mockResolvedValue([show('ted'), show('arrival')]);
    vi.spyOn(Math, 'random').mockReturnValue(0.6);

    await expect(pickAnything()).resolves.toEqual({ kind: 'show', showId: 'arrival' });
    expect(fetchLibraryItems).not.toHaveBeenCalled();
  });

  it('counts a programme once however long it ran', async () => {
    fetchLibraries.mockResolvedValue([
      { id: 'films', kind: 'movies' },
      { id: 'shows-1', kind: 'shows' },
    ]);
    fetchLibraryItems.mockResolvedValue({ items: [item('a-film')], total: 1 });
    fetchShows.mockResolvedValue([show('a-soap', 2000)]);
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    await expect(pickAnything()).resolves.toEqual({ kind: 'item', item: item('a-film') });
  });

  it('narrows to the kind that was asked for', async () => {
    fetchLibraries.mockResolvedValue([
      { id: 'films', kind: 'movies' },
      { id: 'shows-1', kind: 'shows' },
    ]);
    fetchShows.mockResolvedValue([show('ted')]);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(pickAnything('shows')).resolves.toEqual({ kind: 'show', showId: 'ted' });
    expect(fetchLibraryItems).not.toHaveBeenCalled();
  });

  it('answers with nothing where there is nothing to watch', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'library-1', kind: 'movies' }]);
    fetchLibraryItems.mockResolvedValue({ items: [], total: 0 });

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('answers with nothing rather than throwing when the server cannot be reached', async () => {
    fetchLibraries.mockRejectedValue(new Error('offline'));

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('carries on when one shelf cannot be counted', async () => {
    fetchLibraries.mockResolvedValue([
      { id: 'broken', kind: 'movies' },
      { id: 'library-1', kind: 'movies' },
    ]);
    fetchLibraryItems.mockImplementation((libraryId: string) =>
      libraryId === 'broken'
        ? Promise.reject(new Error('gone'))
        : Promise.resolve({ items: [item('a')], total: 10 }),
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(pickAnything()).resolves.toMatchObject({ item: { id: 'a' } });
  });
});

describe('pickAnything, when a library will not answer', () => {
  it('offers nothing from a programmes library whose shows cannot be read', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'shows-1', kind: 'shows' }]);
    fetchShows.mockRejectedValue(new Error('offline'));

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('offers nothing from a films library whose items cannot be counted', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'library-1', kind: 'movies' }]);
    fetchLibraryItems.mockRejectedValue(new Error('offline'));

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('still offers what the libraries that did answer are holding', async () => {
    fetchLibraries.mockResolvedValue([
      { id: 'shows-1', kind: 'shows' },
      { id: 'library-1', kind: 'movies' },
    ]);
    fetchShows.mockRejectedValue(new Error('offline'));
    fetchLibraryItems.mockResolvedValue({ items: [item('arrival')], total: 1 });

    await expect(pickAnything()).resolves.toEqual({ kind: 'item', item: item('arrival') });
  });
});
