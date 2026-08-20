import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { book, bookChapter, library, readingProgress } from '@FluxServer/db/Schema';
import sharp from 'sharp';
import { z } from 'zod';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import {
  BookFormatSchema,
  BookLayoutSchema,
  ReadingDirectionSchema,
} from '@FluxContracts/schemas/Book';
import { imageTypeFor } from './imageTypeFor';
import { openBookFile } from './openBookFile';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type {
  Book,
  BookDetail,
  ReadingProgress,
  SaveReadingProgress,
} from '@FluxContracts/schemas/Book';
import type { BookPageBytes } from './BookFile';
import type { BookStore } from './scanBookLibrary';

const WEBP_QUALITY = 82;

const WIDEST = 3840;

const EXTENSIONS = new Map([
  ['image/webp', 'webp'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
  ['image/bmp', 'bmp'],
]);

type BookService = BookStore & {
  list: (libraryId: string) => Promise<Book[]>;
  read: (bookId: string) => Promise<BookDetail | null>;
  readPage: (chapterId: string, page: number, width?: number) => Promise<BookPageBytes | null>;
  readDocument: (chapterId: string, addressFor: (href: string) => string) => Promise<string | null>;
  readResource: (chapterId: string, href: string) => Promise<BookPageBytes | null>;
  readCover: (bookId: string) => Promise<BookPageBytes | null>;
  saveProgress: (
    profileId: string,
    chapterId: string,
    where: SaveReadingProgress,
  ) => Promise<boolean>;
  readProgress: (profileId: string, bookId: string) => Promise<ReadingProgress[]>;
};

const NamesSchema = z.array(z.string()).nullable().catch(null);

/**
 * Reads a list of names out of whatever the database gave back for a JSON column.
 *
 * A JSON column is whatever was put in it, which is not a thing the database will vouch for, so it
 * is read through a schema rather than trusted to be what it was when it was written.
 *
 * @param held - What was stored.
 * @returns The names, or nothing where what was stored was not a list of them.
 */
const namesIn = (held: JsonValue): string[] | null => NamesSchema.parse(held);

/**
 * The shelf: what is on it, what is inside each thing on it, and where everybody is up to.
 *
 * A page is cached the first time it is asked for. Getting one means finding it inside an archive
 * and inflating it, or in the case of a document drawing it, and neither is work worth doing twice —
 * somebody reading turns the same pages back and forth, and everybody in a household reads the same
 * volume eventually. Cached pages sit beside the artwork, so the job that tidies that away one day
 * tidies these too.
 *
 * @param db - The database.
 * @param cacheDir - Where pages are kept once they have been read.
 * @returns The service, which the scan writes through and the routes read through.
 */
const createDatabaseBookService = (db: FluxDatabase, cacheDir: string): BookService => {
  const chapterFor = async (chapterId: string) => {
    const [found] = await db
      .select({
        id: bookChapter.id,
        path: bookChapter.path,
        bookId: bookChapter.bookId,
        format: bookChapter.format,
      })
      .from(bookChapter)
      .where(eq(bookChapter.id, chapterId))
      .limit(1);

    return found ?? null;
  };

  const cachedAt = (
    chapterId: string,
    page: number,
    width: number | null,
    contentType: string,
  ): string => {
    const named = `${page.toString()}${width === null ? '' : `@${width.toString()}`}`;

    return join(cacheDir, 'books', chapterId, `${named}.${EXTENSIONS.get(contentType) ?? 'bin'}`);
  };

  const readCached = async (
    chapterId: string,
    page: number,
    width: number | null,
  ): Promise<BookPageBytes | null> => {
    for (const [contentType] of EXTENSIONS) {
      const bytes = await readFile(cachedAt(chapterId, page, width, contentType)).catch(() => null);

      if (bytes !== null) {
        return { bytes: new Uint8Array(bytes), contentType };
      }
    }

    return null;
  };

  const keep = async (
    chapterId: string,
    page: number,
    width: number | null,
    held: BookPageBytes,
  ): Promise<void> => {
    const at = cachedAt(chapterId, page, width, held.contentType);

    await mkdir(dirname(at), { recursive: true }).catch(() => null);
    await writeFile(at, held.bytes).catch(() => null);
  };

  /**
   * Draws a page down to the width somebody asked for.
   *
   * A page out of a volume is a megabyte and a half of picture and sometimes three, which is a lot to
   * send a phone for something it will draw a thousand pixels wide. Narrowed pages go out as WebP,
   * which is a great deal smaller for line art and screentone than what these archives hold.
   *
   * A page that will not draw is sent as it came rather than not at all.
   *
   * @param held - The page as it was found.
   * @param width - How wide it is wanted.
   * @returns The page, narrowed where that worked.
   */
  const narrowed = async (held: BookPageBytes, width: number): Promise<BookPageBytes> => {
    const drawn = await sharp(held.bytes)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
      .catch(() => null);

    return drawn === null ? held : { bytes: new Uint8Array(drawn), contentType: 'image/webp' };
  };

  const pageOf = async (
    chapterId: string,
    page: number,
    width?: number,
  ): Promise<BookPageBytes | null> => {
    const wanted = width === undefined || width <= 0 ? null : Math.min(width, WIDEST);
    const already = await readCached(chapterId, page, wanted);

    if (already !== null) {
      return already;
    }

    const chapter = await chapterFor(chapterId);
    const opened = chapter === null ? null : await openBookFile(chapter.path).catch(() => null);

    if (opened === null || opened.layout !== 'fixed') {
      return null;
    }

    const read = await opened.readPage(page);

    if (read === null) {
      return null;
    }

    const held = wanted === null ? read : await narrowed(read, wanted);

    await keep(chapterId, page, wanted, held);

    return held;
  };
  return {
    listStored: async (libraryId) => {
      const rows = await db
        .select({
          path: bookChapter.path,
          sizeBytes: bookChapter.sizeBytes,
          modifiedAtMs: bookChapter.modifiedAtMs,
        })
        .from(bookChapter)
        .innerJoin(book, eq(book.id, bookChapter.bookId))
        .where(eq(book.libraryId, libraryId));

      return rows;
    },

    upsertBook: async (row) => {
      await db
        .insert(book)
        .values({
          id: randomUUID(),
          libraryId: row.libraryId,
          path: row.path,
          title: row.title,
          layout: row.layout,
          direction: row.direction,
          year: row.year,
        })
        .onConflictDoUpdate({
          target: [book.libraryId, book.path],
          set: { title: row.title, layout: row.layout, year: row.year, updatedAt: new Date() },
        });
    },

    upsertChapter: async (libraryId, row) => {
      const [owner] = await db
        .select({ id: book.id })
        .from(book)
        .where(and(eq(book.libraryId, libraryId), eq(book.path, row.bookPath)))
        .limit(1);

      if (owner === undefined) {
        return;
      }

      await db
        .insert(bookChapter)
        .values({
          id: randomUUID(),
          bookId: owner.id,
          path: row.path,
          number: row.number,
          title: row.title,
          format: row.format,
          pageCount: row.pageCount,
          sizeBytes: row.sizeBytes,
          modifiedAtMs: row.modifiedAtMs,
        })
        .onConflictDoUpdate({
          target: [bookChapter.bookId, bookChapter.path],
          set: {
            number: row.number,
            title: row.title,
            format: row.format,
            pageCount: row.pageCount,
            sizeBytes: row.sizeBytes,
            modifiedAtMs: row.modifiedAtMs,
          },
        });
    },

    removeByPaths: async (libraryId, paths) => {
      if (paths.length === 0) {
        return 0;
      }

      const owned = await db
        .select({ id: bookChapter.id })
        .from(bookChapter)
        .innerJoin(book, eq(book.id, bookChapter.bookId))
        .where(and(eq(book.libraryId, libraryId), inArray(bookChapter.path, paths)));

      if (owned.length === 0) {
        return 0;
      }

      await db.delete(bookChapter).where(
        inArray(
          bookChapter.id,
          owned.map((row) => row.id),
        ),
      );

      return owned.length;
    },

    markScanned: async (libraryId) => {
      await db.update(library).set({ lastScannedAt: new Date() }).where(eq(library.id, libraryId));
    },

    list: async (libraryId) => {
      const rows = await db
        .select()
        .from(book)
        .where(eq(book.libraryId, libraryId))
        .orderBy(asc(book.title));

      const counted = await db
        .select({ bookId: bookChapter.bookId, id: bookChapter.id })
        .from(bookChapter);

      const howMany = new Map<string, number>();

      for (const row of counted) {
        howMany.set(row.bookId, (howMany.get(row.bookId) ?? 0) + 1);
      }

      return rows.map((row) => ({
        id: row.id,
        libraryId: row.libraryId,
        title: row.title,
        layout: BookLayoutSchema.catch('fixed').parse(row.layout),
        direction: ReadingDirectionSchema.catch('leftToRight').parse(row.direction),
        year: row.year,
        overview: row.overview,
        genres: namesIn(JsonValueSchema.catch(null).parse(row.genres ?? null)),
        authors: namesIn(JsonValueSchema.catch(null).parse(row.authors ?? null)),
        rating: row.rating,
        posterUrl: row.posterUrl,
        hasCover: true,
        chapterCount: howMany.get(row.id) ?? 0,
        addedAt: row.addedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    read: async (bookId) => {
      const [row] = await db.select().from(book).where(eq(book.id, bookId)).limit(1);

      if (row === undefined) {
        return null;
      }

      const chapters = await db
        .select()
        .from(bookChapter)
        .where(eq(bookChapter.bookId, bookId))
        .orderBy(asc(bookChapter.number));

      return {
        book: {
          id: row.id,
          libraryId: row.libraryId,
          title: row.title,
          layout: BookLayoutSchema.catch('fixed').parse(row.layout),
          direction: ReadingDirectionSchema.catch('leftToRight').parse(row.direction),
          year: row.year,
          overview: row.overview,
          genres: namesIn(JsonValueSchema.catch(null).parse(row.genres ?? null)),
          authors: namesIn(JsonValueSchema.catch(null).parse(row.authors ?? null)),
          rating: row.rating,
          posterUrl: row.posterUrl,
          hasCover: chapters.length > 0,
          chapterCount: chapters.length,
          addedAt: row.addedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          bookId: chapter.bookId,
          number: chapter.number,
          title: chapter.title,
          format: BookFormatSchema.catch('cbz').parse(chapter.format),
          pageCount: chapter.pageCount,
          addedAt: chapter.addedAt.toISOString(),
        })),
      };
    },

    readPage: pageOf,

    readDocument: async (chapterId, addressFor) => {
      const chapter = await chapterFor(chapterId);
      const opened =
        chapter === null ? null : await openBookFile(chapter.path, addressFor).catch(() => null);

      return opened === null || opened.layout !== 'reflow'
        ? null
        : opened.readDocument(chapter?.path ?? '');
    },

    readResource: async (chapterId, href) => {
      const chapter = await chapterFor(chapterId);
      const opened = chapter === null ? null : await openBookFile(chapter.path).catch(() => null);

      return opened === null || opened.layout !== 'reflow' ? null : opened.readResource(href);
    },

    readCover: async (bookId) => {
      const [first] = await db
        .select({ id: bookChapter.id })
        .from(bookChapter)
        .where(eq(bookChapter.bookId, bookId))
        .orderBy(asc(bookChapter.number))
        .limit(1);

      return first === undefined ? null : pageOf(first.id, 0);
    },

    saveProgress: async (profileId, chapterId, where) => {
      const chapter = await chapterFor(chapterId);

      if (chapter === null || (where.pageNumber === null && where.fraction === null)) {
        return false;
      }

      await db
        .insert(readingProgress)
        .values({
          id: randomUUID(),
          profileId,
          bookId: chapter.bookId,
          chapterId,
          pageNumber: where.pageNumber,
          fraction: where.fraction,
          isFinished: where.isFinished,
        })
        .onConflictDoUpdate({
          target: [readingProgress.profileId, readingProgress.chapterId],
          set: {
            pageNumber: where.pageNumber,
            fraction: where.fraction,
            isFinished: where.isFinished,
            updatedAt: new Date(),
          },
        });

      return true;
    },

    readProgress: async (profileId, bookId) => {
      const rows = await db
        .select()
        .from(readingProgress)
        .where(and(eq(readingProgress.profileId, profileId), eq(readingProgress.bookId, bookId)));

      return rows.map((row) => ({
        bookId: row.bookId,
        chapterId: row.chapterId,
        pageNumber: row.pageNumber,
        fraction: row.fraction,
        isFinished: row.isFinished,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  };
};

export type { BookService };

export { createDatabaseBookService, imageTypeFor };
