type BookPageBytes = {
  bytes: Uint8Array;
  contentType: string;
};

type SpineEntry = {
  href: string;
  title: string;
};

type FixedBook = {
  layout: 'fixed';
  pageCount: number;
  readPage: (at: number) => Promise<BookPageBytes | null>;
};

type ReflowBook = {
  layout: 'reflow';
  spine: SpineEntry[];
  readDocument: (href: string) => Promise<string | null>;
  readResource: (href: string) => Promise<BookPageBytes | null>;
};

type OpenedBook = FixedBook | ReflowBook;

export type { BookPageBytes, FixedBook, OpenedBook, ReflowBook, SpineEntry };
