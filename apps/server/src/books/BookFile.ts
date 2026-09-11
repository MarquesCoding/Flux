type BookPageBytes = {
  bytes: Uint8Array;
  contentType: string;
};

type SpineEntry = {
  href: string;
  title: string;
};

type BookAbout = {
  series: string | null;
  title: string | null;
  authors: string[];
  description: string | null;
};

type FixedBook = {
  layout: 'fixed';
  pageCount: number;
  about?: BookAbout;
  readPage: (at: number) => Promise<BookPageBytes | null>;
};

type ReflowBook = {
  layout: 'reflow';
  spine: SpineEntry[];
  about?: BookAbout;
  readDocument: (href: string) => Promise<string | null>;
  readResource: (href: string) => Promise<BookPageBytes | null>;
};

type OpenedBook = FixedBook | ReflowBook;

export type { BookAbout, BookPageBytes, FixedBook, OpenedBook, ReflowBook, SpineEntry };
