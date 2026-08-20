import { open } from 'node:fs/promises';

const END_OF_CENTRAL_DIRECTORY = 0x06_05_4b_50;

const CENTRAL_FILE_HEADER = 0x02_01_4b_50;

const END_MINIMUM = 22;

const COMMENT_MAXIMUM = 0xff_ff;

const CENTRAL_MINIMUM = 46;

const STORED = 0;

const DEFLATED = 8;

const NEEDS_ZIP64 = 0xff_ff_ff_ff;

type ZipEntry = {
  name: string;
  isCompressed: boolean;
  compressedSize: number;
  uncompressedSize: number;
  headerOffset: number;
};

/**
 * Finds the end of a zip's central directory, which is the only place its contents are listed.
 *
 * A zip is read from the back. The record naming everything inside it sits at the very end, except
 * that a comment of any length may follow, so the last sixty-odd kilobytes are searched backwards
 * for the signature rather than read from a known offset.
 *
 * @param tail - The last stretch of the file.
 * @returns Where the directory starts and how many entries it holds, or nothing where this is not a
 *   zip at all.
 */
const findTheDirectory = (tail: DataView): { at: number; count: number; size: number } | null => {
  for (let at = tail.byteLength - END_MINIMUM; at >= 0; at -= 1) {
    if (tail.getUint32(at, true) !== END_OF_CENTRAL_DIRECTORY) {
      continue;
    }

    return {
      count: tail.getUint16(at + 10, true),
      size: tail.getUint32(at + 12, true),
      at: tail.getUint32(at + 16, true),
    };
  }

  return null;
};

/**
 * Lists what is inside a zip without unpacking any of it.
 *
 * Only the directory at the end is read, which is kilobytes whatever the archive weighs — a volume
 * of manga is half a gigabyte of pictures, and knowing it holds a hundred and ninety-three pages
 * should not mean decompressing a hundred and ninety-three pages.
 *
 * The order entries are listed in is the order they were written, which is not the order they are
 * read in: the archives this was built against list their pages shuffled. Sorting is left to the
 * caller, which knows what the names mean.
 *
 * @param path - The archive.
 * @returns What is inside it, or nothing where the file is not a zip or is one this cannot read.
 */
const readZipDirectory = async (path: string): Promise<ZipEntry[] | null> => {
  const file = await open(path, 'r').catch(() => null);

  if (file === null) {
    return null;
  }

  try {
    const { size } = await file.stat();
    const span = Math.min(size, END_MINIMUM + COMMENT_MAXIMUM);
    const tail = Buffer.alloc(span);

    await file.read(tail, 0, span, size - span);

    const found = findTheDirectory(new DataView(tail.buffer, tail.byteOffset, tail.byteLength));

    if (found === null || found.at === NEEDS_ZIP64 || found.count === 0xff_ff) {
      return null;
    }

    const directory = Buffer.alloc(found.size);

    await file.read(directory, 0, found.size, found.at);

    const reading = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
    const entries: ZipEntry[] = [];
    let at = 0;

    for (let which = 0; which < found.count; which += 1) {
      if (at + CENTRAL_MINIMUM > reading.byteLength) {
        return null;
      }

      if (reading.getUint32(at, true) !== CENTRAL_FILE_HEADER) {
        return null;
      }

      const method = reading.getUint16(at + 10, true);
      const compressedSize = reading.getUint32(at + 20, true);
      const uncompressedSize = reading.getUint32(at + 24, true);
      const nameLength = reading.getUint16(at + 28, true);
      const extraLength = reading.getUint16(at + 30, true);
      const commentLength = reading.getUint16(at + 32, true);
      const headerOffset = reading.getUint32(at + 42, true);

      if (compressedSize === NEEDS_ZIP64 || headerOffset === NEEDS_ZIP64) {
        return null;
      }

      const name = directory.toString(
        'utf8',
        at + CENTRAL_MINIMUM,
        at + CENTRAL_MINIMUM + nameLength,
      );

      if ((method === STORED || method === DEFLATED) && !name.endsWith('/')) {
        entries.push({
          name,
          isCompressed: method === DEFLATED,
          compressedSize,
          uncompressedSize,
          headerOffset,
        });
      }

      at += CENTRAL_MINIMUM + nameLength + extraLength + commentLength;
    }

    return entries;
  } finally {
    await file.close();
  }
};

export type { ZipEntry };

export { readZipDirectory };
