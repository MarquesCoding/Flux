import type { Book } from '@ValenceContracts/schemas/Book';

type BookRailProps = {
  libraryId: string;
  title: string;
  onOpen: (book: Book) => void;
};

export type { BookRailProps };
