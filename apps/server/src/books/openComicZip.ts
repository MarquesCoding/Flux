import { imageTypeFor } from './imageTypeFor';
import { inPageOrder } from './inPageOrder';
import { readZipDirectory } from './readZipDirectory';
import { readZipEntry } from './readZipEntry';
import type { ZipEntry } from './readZipDirectory';

type BookPageBytes = {
  bytes: Uint8Array;
  contentType: string;
};

type FixedBook = {
  layout: 'fixed';
  pageCount: number;
  readPage: (at: number) => Promise<BookPageBytes | null>;
};

/**
 * Opens a comic archive, which is a zip of pictures and not much else.
 *
 * Only the archive's own listing is read, never its contents: a volume of manga is half a gigabyte
 * of pictures, and knowing how many pages it holds should not cost the price of decompressing them.
 * A page is inflated when somebody turns to it, and one at a time.
 *
 * Anything in the archive that is not a picture is left out — a listing of contents, a note from
 * whoever made it — because it is not a page and nobody turning pages wants to land on it.
 *
 * @param path - The archive.
 * @returns The pages and how to read one, or nothing where this is not a comic archive.
 */
const openComicZip = async (path: string): Promise<FixedBook | null> => {
  const entries = await readZipDirectory(path);

  if (entries === null) {
    return null;
  }

  const pages = new Map<string, ZipEntry>();

  for (const entry of entries) {
    if (imageTypeFor(entry.name) !== null) {
      pages.set(entry.name, entry);
    }
  }

  const ordered = inPageOrder([...pages.keys()]);

  if (ordered.length === 0) {
    return null;
  }

  return {
    layout: 'fixed',
    pageCount: ordered.length,
    readPage: async (at) => {
      const name = ordered[at];
      const entry = name === undefined ? undefined : pages.get(name);
      const contentType = name === undefined ? null : imageTypeFor(name);

      if (entry === undefined || contentType === null) {
        return null;
      }

      const bytes = await readZipEntry(path, entry);

      return bytes === null ? null : { bytes, contentType };
    },
  };
};

export type { BookPageBytes, FixedBook };

export { openComicZip };
