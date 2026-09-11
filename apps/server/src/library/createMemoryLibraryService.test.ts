import { describe, expect, it } from 'vitest';
import { createMemoryLibraryService } from './createMemoryLibraryService';
import type { MediaDetail } from '@ValenceContracts/schemas/Library';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const film = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: 'film-1',
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 1920,
  height: 1080,
  bitrateKbps: 12000,
  audioStreams: [],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
  ...overrides,
});

const everything = { limit: 50, offset: 0 } as const;

const theLibrary = {
  id: LIBRARY_ID,
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 0,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
} as const;

describe('what a library offers to filter by', () => {
  it('gathers the genres held across every item, in order and without repeats', async () => {
    const service = createMemoryLibraryService({
      libraries: [],
      media: [
        film({
          id: 'a',
          metadata: {
            hasPoster: false,
            hasBackdrop: false,
            hasLogo: false,
            genres: ['Sci-Fi', 'Drama'],
          },
        }),
        film({
          id: 'b',
          metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, genres: ['Drama'] },
        }),
      ],
    });

    await expect(service.listFacets()).resolves.toMatchObject({ genres: ['Drama', 'Sci-Fi'] });
  });

  it('counts an item with no year as no decade, rather than as the nineteen-seventies', async () => {
    const service = createMemoryLibraryService({
      libraries: [],
      media: [film({ id: 'a', year: 2016 }), film({ id: 'b', year: null })],
    });

    await expect(service.listFacets()).resolves.toMatchObject({ decades: [2010] });
  });
});

describe('ordering a listing', () => {
  const starred = (stars: Record<string, number>) =>
    createMemoryLibraryService({
      libraries: [theLibrary],
      media: [
        film({ id: 'a', title: 'Arrival' }),
        film({ id: 'b', title: 'Blade Runner' }),
        film({ id: 'c', title: 'Contact' }),
      ],
      starsFor: (mediaId) => stars[mediaId] ?? null,
    });

  it('puts what this viewer rated highest first', async () => {
    const found = await starred({ a: 3, b: 5, c: 1 }).listItems(LIBRARY_ID, {
      ...everything,
      order: 'yourRating',
    });

    expect(found?.items.map((one) => one.id)).toEqual(['b', 'a', 'c']);
  });

  it('falls back to the title where two are rated the same', async () => {
    const found = await starred({ a: 5, b: 5, c: 5 }).listItems(LIBRARY_ID, {
      ...everything,
      order: 'yourRating',
    });

    expect(found?.items.map((one) => one.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats an unrated item as nought rather than dropping it', async () => {
    const found = await starred({ b: 4 }).listItems(LIBRARY_ID, {
      ...everything,
      order: 'yourRating',
    });

    expect(found?.items.map((one) => one.id)).toEqual(['b', 'a', 'c']);
  });

  it('puts the most recently added first when asked for newest', async () => {
    const service = createMemoryLibraryService({
      libraries: [theLibrary],
      media: [
        film({ id: 'old', title: 'Arrival', addedAt: '2026-01-01T00:00:00.000Z' }),
        film({ id: 'new', title: 'Blade Runner', addedAt: '2026-08-01T00:00:00.000Z' }),
      ],
    });

    const found = await service.listItems(LIBRARY_ID, { ...everything, order: 'newest' });

    expect(found?.items.map((one) => one.id)).toEqual(['new', 'old']);
  });
});

describe('reaching a programme and its episodes', () => {
  it('answers with nothing where no series is held at all', async () => {
    const service = createMemoryLibraryService({ libraries: [], media: [] });

    await expect(service.getSeries('nothing')).resolves.toBeNull();
  });

  it('finds a series that is held', async () => {
    const service = createMemoryLibraryService({
      libraries: [],
      media: [],
      series: [{ id: 'severance', title: 'Severance' }],
    });

    await expect(service.getSeries('severance')).resolves.toEqual({
      id: 'severance',
      title: 'Severance',
    });
  });

  it('answers with nothing when asked which series an item nobody holds belongs to', async () => {
    const service = createMemoryLibraryService({ libraries: [], media: [] });

    await expect(service.seriesOf('missing')).resolves.toBeNull();
  });
});

describe('what a share reaches', () => {
  const service = createMemoryLibraryService({
    libraries: [],
    media: [film({ id: 'a' }), film({ id: 'b' })],
  });

  it('reaches exactly the item a link names', async () => {
    const reached = await service.itemsForShare({ kind: 'item', mediaId: 'a', seriesId: null });

    expect(reached.map((one) => one.id)).toEqual(['a']);
  });

  it('reaches nothing where a link names no item at all', async () => {
    const reached = await service.itemsForShare({ kind: 'item', mediaId: null, seriesId: null });

    expect(reached).toEqual([]);
  });

  it('reaches nothing where a series link names no series', async () => {
    const reached = await service.itemsForShare({ kind: 'series', mediaId: null, seriesId: null });

    expect(reached).toEqual([]);
  });
});

describe('finding what somebody appeared in', () => {
  it('finds nothing in items whose cast is not known', async () => {
    const service = createMemoryLibraryService({ libraries: [], media: [film()] });

    await expect(service.findByPerson(1)).resolves.toEqual([]);
  });

  it('answers with nothing about a person nobody holds', async () => {
    const service = createMemoryLibraryService({ libraries: [], media: [] });

    await expect(service.readPerson(1)).resolves.toBeNull();
  });
});

describe('asking a library that is not held to do something', () => {
  const empty = createMemoryLibraryService({ libraries: [], media: [] });

  it('starts no job to fetch logos', async () => {
    await expect(empty.fetchLogos(LIBRARY_ID)).resolves.toBeNull();
  });

  it('starts no job to make thumbnails again', async () => {
    await expect(empty.regenerateTrickplay(LIBRARY_ID)).resolves.toBeNull();
  });

  it('starts no job to look for intros', async () => {
    await expect(empty.detectSegments(LIBRARY_ID)).resolves.toBeNull();
  });

  it('starts no job to make previews again', async () => {
    await expect(empty.regeneratePreviews(LIBRARY_ID)).resolves.toBeNull();
  });

  it('remakes no previews for a library it does not hold', async () => {
    await expect(empty.remakePreviews(LIBRARY_ID)).resolves.toBeNull();
  });

  it('builds no programme from a library it does not hold', async () => {
    await expect(empty.getShow(LIBRARY_ID, 'severance')).resolves.toBeNull();
  });

  it('points at no artwork for an item it does not hold', async () => {
    await expect(empty.readArtworkUrl('nothing', 'poster')).resolves.toBeNull();
  });
});
