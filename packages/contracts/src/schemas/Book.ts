import { z } from 'zod';

const BOOK_LAYOUTS = ['fixed', 'reflow'] as const;

const BOOK_FORMATS = ['cbz', 'cbr', 'pdf', 'epub'] as const;

const READING_DIRECTIONS = ['rightToLeft', 'leftToRight'] as const;

const BookLayoutSchema = z.enum(BOOK_LAYOUTS);

const BookFormatSchema = z.enum(BOOK_FORMATS);

const ReadingDirectionSchema = z.enum(READING_DIRECTIONS);

const BookChapterSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  number: z.number(),
  title: z.string(),
  format: BookFormatSchema,
  pageCount: z.number().int().positive().nullable(),
  addedAt: z.string(),
});

const BookSchema = z.object({
  id: z.string().uuid(),
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  layout: BookLayoutSchema,
  direction: ReadingDirectionSchema,
  year: z.number().int().min(1400).max(2200).nullable(),
  overview: z.string().nullable(),
  genres: z.array(z.string()).nullable(),
  authors: z.array(z.string()).nullable(),
  rating: z.number().nullable(),
  posterUrl: z.string().url().nullish(),
  hasCover: z.boolean().default(false),
  chapterCount: z.number().int().nonnegative(),
  addedAt: z.string(),
  updatedAt: z.string(),
});

const BookDetailSchema = z.object({
  book: BookSchema,
  chapters: z.array(BookChapterSchema),
});

const BookPageSchema = z.object({
  items: z.array(BookSchema),
  total: z.number().int().nonnegative(),
});

const ReadingProgressSchema = z.object({
  bookId: z.string().uuid(),
  chapterId: z.string().uuid(),
  pageNumber: z.number().int().nonnegative().nullable(),
  fraction: z.number().min(0).max(1).nullable(),
  isFinished: z.boolean(),
  updatedAt: z.string(),
});

const SaveReadingProgressSchema = z.object({
  pageNumber: z.number().int().nonnegative().nullable(),
  fraction: z.number().min(0).max(1).nullable(),
  isFinished: z.boolean().default(false),
});

/**
 * Which way a book is read where nobody has said, decided by what it is.
 *
 * Manga is read right to left, and a comic or a novel left to right. Neither is knowable from the
 * file, so the layout stands in for it: a fixed-page book in a Flux library is overwhelmingly manga,
 * and anybody it is wrong for can say so once and be remembered.
 *
 * @param layout - Whether the book paginates ahead of time or reflows.
 * @returns The direction to read it in until somebody says otherwise.
 */
const directionFor = (
  layout: z.infer<typeof BookLayoutSchema>,
): z.infer<typeof ReadingDirectionSchema> => (layout === 'fixed' ? 'rightToLeft' : 'leftToRight');

export type BookLayout = z.infer<typeof BookLayoutSchema>;
export type BookFormat = z.infer<typeof BookFormatSchema>;
export type ReadingDirection = z.infer<typeof ReadingDirectionSchema>;
export type Book = z.infer<typeof BookSchema>;
export type BookChapter = z.infer<typeof BookChapterSchema>;
export type BookDetail = z.infer<typeof BookDetailSchema>;
export type BookPage = z.infer<typeof BookPageSchema>;
export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;
export type SaveReadingProgress = z.infer<typeof SaveReadingProgressSchema>;

export {
  BOOK_FORMATS,
  BOOK_LAYOUTS,
  READING_DIRECTIONS,
  BookChapterSchema,
  BookDetailSchema,
  BookFormatSchema,
  BookLayoutSchema,
  BookPageSchema,
  BookSchema,
  ReadingDirectionSchema,
  ReadingProgressSchema,
  SaveReadingProgressSchema,
  directionFor,
};
