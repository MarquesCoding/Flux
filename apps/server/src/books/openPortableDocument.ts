import { readFile } from 'node:fs/promises';
import { ColorSpace, Document, Matrix } from 'mupdf';
import type { FixedBook } from './BookFile';

const RENDER_AT = 2;

/**
 * Opens a PDF, and draws its pages rather than unpacking them.
 *
 * A PDF holds instructions, not pictures — text, vectors and fonts that mean nothing until somebody
 * decides how large to draw them. So a page here is rendered, at twice its nominal size so it holds
 * up on a screen that has more pixels than points, and handed over as a picture like every other
 * page in Valence. What reaches a reader is the same whatever the file was.
 *
 * Drawing is not free, which is the whole reason pages are cached. It is also the reason the size is
 * fixed here rather than taken from the request: a reader that asked for a different width on every
 * turn would render the same page again and again.
 *
 * @param path - The document.
 * @returns The pages and how to draw one, or nothing where this is not a document that opens.
 */
const openPortableDocument = async (path: string): Promise<FixedBook | null> => {
  const data = await readFile(path).catch(() => null);

  if (data === null) {
    return null;
  }

  const opened = ((): Document | null => {
    try {
      return Document.openDocument(data, 'application/pdf');
    } catch {
      return null;
    }
  })();

  if (opened === null) {
    return null;
  }

  const pageCount = ((): number => {
    try {
      return opened.countPages();
    } catch {
      return 0;
    }
  })();

  if (pageCount === 0) {
    return null;
  }

  return {
    layout: 'fixed',
    pageCount,
    readPage: (at) => {
      if (at < 0 || at >= pageCount) {
        return Promise.resolve(null);
      }

      try {
        const page = opened.loadPage(at);
        const drawn = page.toPixmap(
          Matrix.scale(RENDER_AT, RENDER_AT),
          ColorSpace.DeviceRGB,
          false,
        );
        const bytes = drawn.asPNG();

        return Promise.resolve({ bytes, contentType: 'image/png' });
      } catch {
        return Promise.resolve(null);
      }
    },
  };
};

export { openPortableDocument };
