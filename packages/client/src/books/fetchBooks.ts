import { z } from 'zod';
import { readFromServer } from '@ValenceClient/query/readFromServer';
import { readFromServerOrAbsent } from '@ValenceClient/query/readFromServerOrAbsent';
import { profileHeaders } from '@ValenceClient/profiles/currentProfile';
import {
  BookDetailSchema,
  BookSchema,
  ReadingProgressSchema,
} from '@ValenceContracts/schemas/Book';
import type { Book, BookDetail, ReadingProgress } from '@ValenceContracts/schemas/Book';

const BookListSchema = z.object({ books: z.array(BookSchema) });

const ProgressListSchema = z.object({ progress: z.array(ReadingProgressSchema) });

/**
 * The books on a shelf.
 *
 * @param libraryId - Which shelf.
 * @returns What is on it.
 */
const fetchBooks = async (libraryId: string): Promise<Book[]> =>
  (await readFromServer(`/api/libraries/${libraryId}/books`, BookListSchema)).books;

/**
 * One book and the chapters in it.
 *
 * @param bookId - The book.
 * @returns The book, or nothing where the shelf no longer holds it.
 */
const fetchBook = (bookId: string): Promise<BookDetail | null> =>
  readFromServerOrAbsent(`/api/books/${bookId}`, BookDetailSchema);

/**
 * Where this profile is up to in a book.
 *
 * @param bookId - The book.
 * @returns Where they are in each chapter they have opened.
 */
const fetchReadingProgress = async (bookId: string): Promise<ReadingProgress[]> =>
  (await readFromServer(`/api/books/${bookId}/progress`, ProgressListSchema)).progress;

/**
 * Remembers where somebody is up to.
 *
 * Sent without waiting on it and without minding whether it lands. Somebody turning a page is
 * telling Valence something, not asking it: a page that stopped to be sure the place had been written
 * would be a page that stutters, and a place that failed to save costs a reader one turn next time.
 *
 * @param bookId - The book.
 * @param chapterId - The chapter they are in.
 * @param pageNumber - Which page they are on.
 * @param isFinished - Whether that was the last of it.
 * @returns Whether it was written.
 */
const saveReadingProgress = async (
  bookId: string,
  chapterId: string,
  pageNumber: number,
  isFinished = false,
): Promise<boolean> => {
  const response = await fetch(`/api/books/${bookId}/chapters/${chapterId}/progress`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...profileHeaders() },
    body: JSON.stringify({ pageNumber, fraction: null, isFinished }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Where to find one page of a chapter.
 *
 * The width is asked for rather than left to the browser, because a page out of a volume is
 * megabytes of picture and a phone will draw it a thousand pixels wide. The server keeps each width
 * it is asked for, so a screen that asks the same question twice pays once.
 *
 * @param bookId - The book.
 * @param chapterId - The chapter.
 * @param page - Which page, counting from zero.
 * @param width - How wide it will be drawn, where that is known.
 * @returns The address.
 */
const bookPageUrl = (bookId: string, chapterId: string, page: number, width?: number): string => {
  const at = `/api/books/${bookId}/chapters/${chapterId}/pages/${page.toString()}`;

  return width === undefined ? at : `${at}?width=${Math.round(width).toString()}`;
};

/**
 * Where to find the cover of a book.
 *
 * @param bookId - The book.
 * @returns The address.
 */
const bookCoverUrl = (bookId: string): string => `/api/books/${bookId}/cover`;

export {
  bookCoverUrl,
  bookPageUrl,
  fetchBook,
  fetchBooks,
  fetchReadingProgress,
  saveReadingProgress,
};
