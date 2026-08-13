import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAnything } from './pickAnything';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type Page = { items: MediaSummary[]; total: number };

const fetchLibraries = vi.fn<() => Promise<{ id: string }[]>>();
const fetchLibraryItems =
  vi.fn<(libraryId: string, options?: { limit?: number; offset?: number }) => Promise<Page>>();

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  fetchLibraries: () => fetchLibraries(),
  fetchLibraryItems: (libraryId: string, options?: { limit?: number; offset?: number }) =>
    fetchLibraryItems(libraryId, options),
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

beforeEach(() => {
  fetchLibraries.mockReset();
  fetchLibraryItems.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pickAnything', () => {
  it('asks for one item from somewhere inside the library', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'library-1' }]);
    fetchLibraryItems
      .mockResolvedValueOnce({ items: [item('a')], total: 40 })
      .mockResolvedValueOnce({ items: [item('b')], total: 40 });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await expect(pickAnything()).resolves.toMatchObject({ id: 'b' });
    expect(fetchLibraryItems).toHaveBeenLastCalledWith('library-1', { limit: 1, offset: 20 });
  });

  it('gives a large shelf its share of the chances', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'small' }, { id: 'large' }]);
    fetchLibraryItems.mockImplementation((libraryId: string) =>
      Promise.resolve({ items: [item(libraryId)], total: libraryId === 'small' ? 1 : 99 }),
    );
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await expect(pickAnything()).resolves.toMatchObject({ id: 'large' });
  });

  it('answers with nothing where there is nothing to watch', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'library-1' }]);
    fetchLibraryItems.mockResolvedValue({ items: [], total: 0 });

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('answers with nothing rather than throwing when the server cannot be reached', async () => {
    fetchLibraries.mockRejectedValue(new Error('offline'));

    await expect(pickAnything()).resolves.toBeNull();
  });

  it('carries on when one shelf cannot be counted', async () => {
    fetchLibraries.mockResolvedValue([{ id: 'broken' }, { id: 'library-1' }]);
    fetchLibraryItems.mockImplementation((libraryId: string) =>
      libraryId === 'broken'
        ? Promise.reject(new Error('gone'))
        : Promise.resolve({ items: [item('a')], total: 10 }),
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(pickAnything()).resolves.toMatchObject({ id: 'a' });
  });
});
