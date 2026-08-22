import { queryOptions } from '@tanstack/react-query';
import { fetchBook, fetchBooks, fetchReadingProgress } from '@ValenceClient/books/fetchBooks';

const BOOKS = ['books'] as const;

/**
 * The books on a shelf.
 *
 * @param libraryId - Which shelf.
 * @returns The query.
 */
const inLibrary = (libraryId: string) =>
  queryOptions({
    queryKey: [...BOOKS, 'library', libraryId],
    queryFn: () => fetchBooks(libraryId),
  });

/**
 * One book and its chapters.
 *
 * @param bookId - The book.
 * @returns The query.
 */
const one = (bookId: string) =>
  queryOptions({
    queryKey: [...BOOKS, 'one', bookId],
    queryFn: () => fetchBook(bookId),
  });

/**
 * Where this profile is up to in a book.
 *
 * @param bookId - The book.
 * @returns The query.
 */
const progress = (bookId: string) =>
  queryOptions({
    queryKey: [...BOOKS, 'progress', bookId],
    queryFn: () => fetchReadingProgress(bookId),
  });

const bookQueries = { inLibrary, one, progress, key: BOOKS };

export { bookQueries };
