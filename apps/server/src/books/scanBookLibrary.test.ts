import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookPathFor, scanBookLibrary } from './scanBookLibrary';
import type { BookRow, BookStore, ChapterRow, ScannedFile, StoredChapter } from './scanBookLibrary';

const A_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

let where = '';

const books: BookRow[] = [];

const chapters: ChapterRow[] = [];

let held: StoredChapter[] = [];

const removeByPaths = vi.fn<(libraryId: string, paths: string[]) => Promise<number>>();

const markScanned = vi.fn<(libraryId: string) => Promise<void>>();

const store = (): BookStore => ({
  listStored: () => Promise.resolve(held),
  upsertBook: (row) => {
    books.push(row);

    return Promise.resolve();
  },
  upsertChapter: (_libraryId, row) => {
    chapters.push(row);

    return Promise.resolve();
  },
  removeByPaths,
  markScanned,
});

const listing = (paths: string[]): ScannedFile[] =>
  paths.map((path) => ({ path, sizeBytes: 10, modifiedAtMs: 100 }));

const aComic = async (path: string, pages: number): Promise<void> => {
  const files: Record<string, Uint8Array> = {};

  for (let at = 1; at <= pages; at += 1) {
    files[`p${String(at).padStart(3, '0')}.png`] = A_PNG;
  }

  await writeFile(path, zipSync(files));
};

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'flux-scan-'));

  await mkdir(join(where, 'Rent-A-Girlfriend (Digital)'), { recursive: true });
  await aComic(join(where, 'Rent-A-Girlfriend (Digital)', 'Rent-A-Girlfriend v01 (2020).cbz'), 3);
  await aComic(join(where, 'Rent-A-Girlfriend (Digital)', 'Rent-A-Girlfriend v02 (2020).cbz'), 4);
  await aComic(join(where, 'Loose Volume.cbz'), 2);
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

beforeEach(() => {
  books.length = 0;
  chapters.length = 0;
  held = [];
  removeByPaths.mockReset().mockResolvedValue(0);
  markScanned.mockReset().mockResolvedValue(undefined);
});

const scan = async (paths: string[], force = false) =>
  scanBookLibrary({
    libraryId: 'a-library',
    root: where,
    files: { listFiles: () => Promise.resolve(listing(paths)) },
    store: store(),
    force,
  });

describe('bookPathFor', () => {
  it('makes the folder the book, since a folder is a series', () => {
    expect(bookPathFor('/library', '/library/Some Manga/v01.cbz')).toBe('/library/Some Manga');
  });

  it('makes a loose file its own book, since it has no folder to belong to', () => {
    expect(bookPathFor('/library', '/library/One Shot.cbz')).toBe('/library/One Shot.cbz');
  });
});

describe('scanBookLibrary', () => {
  it('reads a folder as one book with its chapters', async () => {
    const folder = join(where, 'Rent-A-Girlfriend (Digital)');
    const result = await scan([
      join(folder, 'Rent-A-Girlfriend v01 (2020).cbz'),
      join(folder, 'Rent-A-Girlfriend v02 (2020).cbz'),
    ]);

    expect(result.added).toBe(2);
    expect(books).toHaveLength(1);
    expect(books[0]?.title).toBe('Rent-A-Girlfriend');
    expect(chapters.map((chapter) => chapter.number)).toEqual([1, 2]);
  });

  it('counts the pages of each chapter, which is what a reader needs', async () => {
    const folder = join(where, 'Rent-A-Girlfriend (Digital)');

    await scan([
      join(folder, 'Rent-A-Girlfriend v01 (2020).cbz'),
      join(folder, 'Rent-A-Girlfriend v02 (2020).cbz'),
    ]);

    expect(chapters.map((chapter) => chapter.pageCount)).toEqual([3, 4]);
  });

  it('reads manga right to left, which is how it is read', async () => {
    await scan([join(where, 'Loose Volume.cbz')]);

    expect(books[0]?.direction).toBe('rightToLeft');
    expect(books[0]?.layout).toBe('fixed');
  });

  it('leaves alone what has not changed, so a big library costs the difference', async () => {
    const path = join(where, 'Loose Volume.cbz');
    held = [{ path, sizeBytes: 10, modifiedAtMs: 100 }];

    const result = await scan([path]);

    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect(chapters).toHaveLength(0);
  });

  it('reads a file again when it has been rewritten', async () => {
    const path = join(where, 'Loose Volume.cbz');
    held = [{ path, sizeBytes: 10, modifiedAtMs: 1 }];

    const result = await scan([path]);

    expect(result.updated).toBe(1);
  });

  it('reads everything again when told to, however unchanged it looks', async () => {
    const path = join(where, 'Loose Volume.cbz');
    held = [{ path, sizeBytes: 10, modifiedAtMs: 100 }];

    expect((await scan([path], true)).updated).toBe(1);
  });

  it('forgets a book that is no longer on disk', async () => {
    held = [{ path: join(where, 'Gone.cbz'), sizeBytes: 10, modifiedAtMs: 100 }];
    removeByPaths.mockResolvedValue(1);

    const result = await scan([join(where, 'Loose Volume.cbz')]);

    expect(result.removed).toBe(1);
    expect(removeByPaths).toHaveBeenCalledWith('a-library', [join(where, 'Gone.cbz')]);
  });

  it('reports a file that will not open, and carries on with the rest', async () => {
    const broken = join(where, 'Broken.cbz');
    await writeFile(broken, 'not an archive');

    const problems: string[] = [];
    const result = await scanBookLibrary({
      libraryId: 'a-library',
      root: where,
      files: {
        listFiles: () => Promise.resolve(listing([broken, join(where, 'Loose Volume.cbz')])),
      },
      store: store(),
      onProblem: (path) => problems.push(path),
    });

    expect(result.failed).toBe(1);
    expect(result.added).toBe(1);
    expect(problems).toEqual([broken]);
  });

  it('ignores a film sitting in a books library', async () => {
    const result = await scan([join(where, 'The Matrix.mkv')]);

    expect(result.added).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('says it has been scanned, so the shelf can show when', async () => {
    await scan([join(where, 'Loose Volume.cbz')]);

    expect(markScanned).toHaveBeenCalledWith('a-library');
  });

  it('stops where it is told to, rather than reading the rest', async () => {
    const folder = join(where, 'Rent-A-Girlfriend (Digital)');
    const result = await scanBookLibrary({
      libraryId: 'a-library',
      root: where,
      files: {
        listFiles: () =>
          Promise.resolve(
            listing([
              join(folder, 'Rent-A-Girlfriend v01 (2020).cbz'),
              join(folder, 'Rent-A-Girlfriend v02 (2020).cbz'),
            ]),
          ),
      },
      store: store(),
      isCancelled: () => chapters.length >= 1,
    });

    expect(result.added).toBe(1);
  });
});
