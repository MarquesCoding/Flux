import { cleanBookDocument } from './cleanBookDocument';
import { imageTypeFor } from './imageTypeFor';
import { insideTheBook, packagePathIn, readEpubPackage } from './readEpubPackage';
import { readZipDirectory } from './readZipDirectory';
import { readZipEntry } from './readZipEntry';
import type { ReflowBook, SpineEntry } from './BookFile';
import type { ZipEntry } from './readZipDirectory';

const CONTAINER = 'META-INF/container.xml';

/**
 * Names a chapter for a list somebody chooses from.
 *
 * A spine says the order of a book and nothing about what its parts are called — the names are in a
 * table of contents that is optional and, in older books, in a format of its own. Rather than read a
 * second document that may not be there, a part is named by its position, which is what a reader
 * choosing "the next one" actually wants.
 *
 * @param at - Which part of the book this is.
 * @returns What to call it.
 */
const nameFor = (at: number): string => `Part ${(at + 1).toString()}`;

/**
 * Opens an ebook, which is a zip of documents that lay themselves out wherever they are shown.
 *
 * Nothing here becomes a picture. A page in an EPUB is not a thing the file has an opinion about:
 * how many pages its text makes is decided by the screen, the size somebody set and how wide they
 * hold their phone, so the server hands over the text and the reader decides what a page is.
 *
 * The archive is read the way a comic is — the directory only, then one entry at a time — so opening
 * a book costs its table of contents rather than its contents.
 *
 * @param path - The book.
 * @param addressFor - Turns a path inside the book into one this server serves, for its pictures.
 * @returns The book's parts and how to read one, or nothing where this is not an ebook.
 */
const openEpub = async (
  path: string,
  addressFor: (href: string) => string | null,
): Promise<ReflowBook | null> => {
  const entries = await readZipDirectory(path);

  if (entries === null) {
    return null;
  }

  const held = new Map<string, ZipEntry>();

  for (const entry of entries) {
    held.set(entry.name, entry);
  }

  const containerEntry = held.get(CONTAINER);
  const containerBytes =
    containerEntry === undefined ? null : await readZipEntry(path, containerEntry);

  if (containerBytes === null) {
    return null;
  }

  const packageAt = packagePathIn(new TextDecoder().decode(containerBytes));
  const packageEntry = packageAt === null ? undefined : held.get(packageAt);
  const packageBytes = packageEntry === undefined ? null : await readZipEntry(path, packageEntry);

  if (packageAt === null || packageBytes === null) {
    return null;
  }

  const read = readEpubPackage(packageAt, new TextDecoder().decode(packageBytes));

  if (read.spine.length === 0) {
    return null;
  }

  const base = packageAt.includes('/') ? packageAt.slice(0, packageAt.lastIndexOf('/')) : '';
  const spine: SpineEntry[] = read.spine.map((part, at) => ({
    href: part.href,
    title: nameFor(at),
  }));

  const about =
    read.title === null && read.authors.length === 0 && read.description === null
      ? null
      : { series: null, title: read.title, authors: read.authors, description: read.description };

  return {
    layout: 'reflow',
    spine,
    ...(about === null ? {} : { about }),
    readDocument: async (href) => {
      const wanted = read.spine.find((part) => part.href === href);
      const entry = wanted === undefined ? undefined : held.get(wanted.href);
      const bytes = entry === undefined ? null : await readZipEntry(path, entry);

      if (bytes === null) {
        return null;
      }

      const chapterBase =
        wanted === undefined || !wanted.href.includes('/')
          ? ''
          : wanted.href.slice(0, wanted.href.lastIndexOf('/'));

      return cleanBookDocument(new TextDecoder().decode(bytes), (src) => {
        const inside = insideTheBook(chapterBase, src);

        return inside === null || !held.has(inside) ? null : addressFor(inside);
      });
    },
    readResource: async (href) => {
      const inside = insideTheBook(base, href) ?? href;
      const entry = held.get(inside) ?? held.get(href);
      const contentType = imageTypeFor(inside);

      if (entry === undefined || contentType === null) {
        return null;
      }

      const bytes = await readZipEntry(path, entry);

      return bytes === null ? null : { bytes, contentType };
    },
  };
};

export { openEpub };
