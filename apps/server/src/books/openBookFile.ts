import { openComicRar } from './openComicRar';
import { openComicZip } from './openComicZip';
import { openPortableDocument } from './openPortableDocument';
import type { BookFormat } from '@FluxContracts/schemas/Book';
import type { OpenedBook } from './BookFile';

const FORMATS = new Map<string, BookFormat>([
  ['cbz', 'cbz'],
  ['zip', 'cbz'],
  ['cbr', 'cbr'],
  ['rar', 'cbr'],
  ['pdf', 'pdf'],
  ['epub', 'epub'],
]);

/**
 * What kind of book a file is, judged by its name.
 *
 * By name rather than by content, because this is asked of every file in a library during a scan and
 * opening each one to find out would make a scan cost the library rather than the difference. A file
 * that lies about itself fails when somebody opens it, which is the right place for it to fail.
 *
 * @param path - The file.
 * @returns What it claims to be, or nothing where it claims to be nothing Flux reads.
 */
const bookFormatOf = (path: string): BookFormat | null => {
  const at = path.lastIndexOf('.');

  return at === -1 ? null : (FORMATS.get(path.slice(at + 1).toLowerCase()) ?? null);
};

/**
 * Opens a book, whatever it happens to be stored as.
 *
 * One door onto four formats, so that nothing above this has to know which it is holding. What comes
 * back says how it wants to be read: a fixed book hands over pages as pictures, and a reflowing one
 * hands over documents that lay themselves out against whatever screen they reach.
 *
 * EPUB is not opened here yet, so it is refused rather than half-opened.
 *
 * @param path - The file.
 * @returns The book, or nothing where it cannot be opened as one.
 */
const openBookFile = async (path: string): Promise<OpenedBook | null> => {
  const format = bookFormatOf(path);

  if (format === 'cbz') {
    return openComicZip(path);
  }

  if (format === 'cbr') {
    return openComicRar(path);
  }

  if (format === 'pdf') {
    return openPortableDocument(path);
  }

  return null;
};

export { bookFormatOf, openBookFile };
