import type { Book } from '@ValenceContracts/schemas/Book';

type BookShelfProps = {
  onOpen: (book: Book) => void;
};

export type { BookShelfProps };
