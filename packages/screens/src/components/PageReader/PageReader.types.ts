import type { Book, BookChapter } from '@FluxContracts/schemas/Book';

type PageReaderProps = {
  book: Book;
  chapters: BookChapter[];
  chapterId: string;
  startAtPage?: number;
  onChapterChange: (chapterId: string) => void;
  onPageChange?: (page: number, isFinished: boolean) => void;
  onClose: () => void;
};

export type { PageReaderProps };
