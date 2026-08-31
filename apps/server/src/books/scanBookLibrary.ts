import { basename, dirname, relative, sep } from 'node:path';
import { bookFormatOf, openBookFile } from './openBookFile';
import { readBookTitleFromPath } from './readBookTitleFromPath';
import { readChapterNumberFromPath } from './readChapterNumberFromPath';
import { directionFor } from '@ValenceContracts/schemas/Book';
import type { BookFormat, BookLayout } from '@ValenceContracts/schemas/Book';
import type { ScanResult } from '@ValenceContracts/schemas/Library';

type ScannedFile = {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
};

type StoredChapter = {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
};

type BookRow = {
  libraryId: string;
  path: string;
  title: string;
  layout: BookLayout;
  direction: 'rightToLeft' | 'leftToRight';
  year: number | null;
  authors: string[];
  overview: string | null;
};

type ChapterRow = {
  bookPath: string;
  path: string;
  number: number;
  title: string;
  format: BookFormat;
  pageCount: number | null;
  sizeBytes: number;
  modifiedAtMs: number;
};

type BookFileSystem = {
  listFiles: (root: string) => Promise<ScannedFile[]>;
};

type ArrivedBook = {
  bookId: string;
  title: string;
  year: number | null;
};

type BookStore = {
  listStored: (libraryId: string) => Promise<StoredChapter[]>;
  upsertBook: (row: BookRow) => Promise<string | null>;
  upsertChapter: (libraryId: string, row: ChapterRow) => Promise<void>;
  removeByPaths: (libraryId: string, paths: string[]) => Promise<number>;
  markScanned: (libraryId: string) => Promise<void>;
};

type ScanBookLibraryOptions = {
  libraryId: string;
  root: string;
  files: BookFileSystem;
  store: BookStore;
  force?: boolean;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  onAdded?: (book: ArrivedBook) => void;
  isCancelled?: () => boolean;
};

/**
 * Decides which book a file belongs to.
 *
 * A folder is a series and each file inside it a chapter, so a file's book is the folder holding it
 * — unless that folder is the library itself, in which case the file is a book of its own and stands
 * alone on the shelf.
 *
 * @param root - The library.
 * @param path - The file.
 * @returns Where the book lives, which is a folder or the file itself.
 */
const bookPathFor = (root: string, path: string): string => {
  const folder = dirname(path);
  const within = relative(root, folder);

  return within === '' || within === '.' || within.startsWith(`..${sep}`) ? path : folder;
};

/**
 * Reads a library of books into the shelf.
 *
 * Shaped like the scan that reads films, and skipping in the same way: a file whose size and time
 * are what they were last time is left alone, so a library of thousands that has gained two costs
 * two. What is different is what a file is asked. There is no probing here — FFmpeg reads none of
 * these formats — so a chapter is opened, counted, and closed.
 *
 * A book's layout is decided by the first chapter that opens: fixed where it paginates ahead of
 * time, reflowing where it lays itself out against a screen. A folder holding both is not something
 * that happens, and where it does the rest is reported as a problem rather than quietly mixed.
 *
 * What a file states about itself is preferred over what its path suggested, the same way a
 * catalogue is preferred over a filename for a film — except for the title of a book that lives in a
 * folder, where the folder was named by whoever arranged the shelf and one chapter's own title is
 * not the series it belongs to.
 *
 * @param options - The library, where it is, what to read it with, and where to put it.
 * @returns What the scan changed.
 */
const scanBookLibrary = async (options: ScanBookLibraryOptions): Promise<ScanResult> => {
  const {
    libraryId,
    root,
    files,
    store,
    force = false,
    onProblem,
    onProgress,
    onAdded,
    isCancelled,
  } = options;

  const found = (await files.listFiles(root)).filter((file) => bookFormatOf(file.path) !== null);
  const stored = new Map((await store.listStored(libraryId)).map((row) => [row.path, row]));

  const changed = found.filter((file) => {
    const already = stored.get(file.path);

    return (
      force ||
      already === undefined ||
      already.sizeBytes !== file.sizeBytes ||
      already.modifiedAtMs !== file.modifiedAtMs
    );
  });

  const shelved = new Set([...stored.keys()].map((path) => bookPathFor(root, path)));

  const layouts = new Map<string, BookLayout>();
  const written = new Set<string>();
  let added = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;

  for (const file of changed) {
    if (isCancelled?.() === true) {
      break;
    }

    processed += 1;
    onProgress?.(processed, changed.length);

    const format = bookFormatOf(file.path);
    const opened = await openBookFile(file.path).catch(() => null);

    if (format === null || opened === null) {
      failed += 1;
      onProblem?.(file.path, 'That file could not be opened as a book.');

      continue;
    }

    const bookPath = bookPathFor(root, file.path);
    const settled = layouts.get(bookPath);

    if (settled !== undefined && settled !== opened.layout) {
      failed += 1;
      onProblem?.(file.path, 'That book already reads another way, so this was left out of it.');

      continue;
    }

    layouts.set(bookPath, opened.layout);

    if (!written.has(bookPath)) {
      const named = readBookTitleFromPath(basename(bookPath));
      const about = opened.about ?? null;
      const standsAlone = bookPath === file.path;

      const bookId = await store.upsertBook({
        libraryId,
        path: bookPath,
        title: (standsAlone ? about?.title : null) ?? named.title,
        layout: opened.layout,
        direction: directionFor(opened.layout),
        year: named.year,
        authors: about?.authors ?? [],
        overview: about?.description ?? null,
      });

      written.add(bookPath);

      if (bookId !== null && !shelved.has(bookPath)) {
        onAdded?.({ bookId, title: named.title, year: named.year });
      }
    }

    const name = basename(file.path);
    const number = readChapterNumberFromPath(name);

    await store.upsertChapter(libraryId, {
      bookPath,
      path: file.path,
      number: number ?? 0,
      title: readBookTitleFromPath(name).title,
      format,
      pageCount: opened.layout === 'fixed' ? opened.pageCount : null,
      sizeBytes: file.sizeBytes,
      modifiedAtMs: file.modifiedAtMs,
    });

    if (stored.has(file.path)) {
      updated += 1;
    } else {
      added += 1;
    }
  }

  const gone = [...stored.keys()].filter((path) => !found.some((file) => file.path === path));

  const removed = gone.length === 0 ? 0 : await store.removeByPaths(libraryId, gone);

  await store.markScanned(libraryId);

  return { added, updated, removed, failed };
};

export type {
  ArrivedBook,
  BookFileSystem,
  BookRow,
  BookStore,
  ChapterRow,
  ScanBookLibraryOptions,
  ScannedFile,
  StoredChapter,
};

export { bookPathFor, scanBookLibrary };
