import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readWholeLibrary } from './readWholeLibrary';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const fetchLibraryItemsMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/library/fetchLibrary', () => ({ fetchLibraryItems: fetchLibraryItemsMock }));

const anItem = (id: number): MediaSummary => ({
  id: `item-${id.toString()}`,
  libraryId: 'library-1',
  title: `Item ${id.toString()}`,
  year: 2024,
  durationSeconds: 60,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
});

const aPage = (count: number, total: number) => ({
  items: Array.from({ length: count }, (_unused, index) => anItem(index)),
  total,
});

beforeEach(() => {
  fetchLibraryItemsMock.mockReset();
});

describe('readWholeLibrary', () => {
  it('asks for no more than the server will give, so the read does not fail outright', async () => {
    fetchLibraryItemsMock.mockResolvedValue(aPage(3, 3));

    await readWholeLibrary('library-1');

    expect(fetchLibraryItemsMock).toHaveBeenCalledWith('library-1', { limit: 200, offset: 0 });
  });

  it('reads past the first page, which is where a large library lives', async () => {
    fetchLibraryItemsMock
      .mockResolvedValueOnce(aPage(200, 260))
      .mockResolvedValueOnce(aPage(60, 260));

    const everything = await readWholeLibrary('library-1');

    expect(everything).toHaveLength(260);
    expect(fetchLibraryItemsMock).toHaveBeenNthCalledWith(2, 'library-1', {
      limit: 200,
      offset: 200,
    });
  });

  it('stops once it has the lot, rather than asking for a page that is not there', async () => {
    fetchLibraryItemsMock.mockResolvedValue(aPage(200, 200));

    await readWholeLibrary('library-1');

    expect(fetchLibraryItemsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps what it gathered when a later page fails, since some is better than none', async () => {
    fetchLibraryItemsMock
      .mockResolvedValueOnce(aPage(200, 400))
      .mockRejectedValueOnce(new Error('gone'));

    const everything = await readWholeLibrary('library-1');

    expect(everything).toHaveLength(200);
  });

  it('gives nothing back when the first page fails, without throwing at the caller', async () => {
    fetchLibraryItemsMock.mockRejectedValue(new Error('gone'));

    await expect(readWholeLibrary('library-1')).resolves.toEqual([]);
  });

  it('gives up rather than paging forever when the total is never reached', async () => {
    fetchLibraryItemsMock.mockResolvedValue(aPage(200, 1_000_000));

    await readWholeLibrary('library-1');

    expect(fetchLibraryItemsMock).toHaveBeenCalledTimes(100);
  });
});
