import { readFile } from 'node:fs/promises';
import { createExtractorFromData } from 'node-unrar-js';
import { imageTypeFor } from './imageTypeFor';
import { inPageOrder } from './inPageOrder';
import type { FixedBook } from './BookFile';

/**
 * Opens a comic archive that is a RAR rather than a zip.
 *
 * Unlike a zip this is read whole. RAR has no directory that can be reached without the rest of the
 * file, and the library that understands the format takes bytes rather than a path, so opening a
 * volume costs its weight in memory for as long as the open takes. That is why the pages a reader
 * asks for are cached: the second time through a chapter never comes back here.
 *
 * CBR is the older way of shipping a comic and the rarer one — almost everything is a zip — so this
 * is correctness first and speed a distant second.
 *
 * @param path - The archive.
 * @returns The pages and how to read one, or nothing where this is not a RAR of pictures.
 */
const openComicRar = async (path: string): Promise<FixedBook | null> => {
  const data = await readFile(path).catch(() => null);

  if (data === null) {
    return null;
  }

  const held = new Uint8Array(data).buffer;
  const listing = await createExtractorFromData({ data: held }).catch(() => null);

  if (listing === null) {
    return null;
  }

  const names: string[] = [];

  try {
    for (const header of listing.getFileList().fileHeaders) {
      if (!header.flags.directory && imageTypeFor(header.name) !== null) {
        names.push(header.name);
      }
    }
  } catch {
    return null;
  }

  const ordered = inPageOrder(names);

  if (ordered.length === 0) {
    return null;
  }

  return {
    layout: 'fixed',
    pageCount: ordered.length,
    readPage: async (at) => {
      const name = ordered[at];
      const contentType = name === undefined ? null : imageTypeFor(name);

      if (name === undefined || contentType === null) {
        return null;
      }

      const again = await readFile(path).catch(() => null);

      if (again === null) {
        return null;
      }

      try {
        const extractor = await createExtractorFromData({ data: new Uint8Array(again).buffer });
        const [found] = [...extractor.extract({ files: [name] }).files];
        const bytes = found?.extraction;

        return bytes === undefined ? null : { bytes, contentType };
      } catch {
        return null;
      }
    },
  };
};

export { openComicRar };
