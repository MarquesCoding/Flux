import type { Book } from '@FluxContracts/schemas/Book';

type BookRailProps = {
  libraryId: string;
  title: string;
  onOpen: (book: Book) => void;
};

export type { BookRailProps };
