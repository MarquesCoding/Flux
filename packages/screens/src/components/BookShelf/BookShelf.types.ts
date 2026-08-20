import type { Book } from '@FluxContracts/schemas/Book';

type BookShelfProps = {
  onOpen: (book: Book) => void;
};

export type { BookShelfProps };
