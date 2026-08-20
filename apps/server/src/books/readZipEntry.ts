import { open } from 'node:fs/promises';
import { inflateSync } from 'fflate';
import type { ZipEntry } from './readZipDirectory';

const LOCAL_FILE_HEADER = 0x04_03_4b_50;

const LOCAL_MINIMUM = 30;

/**
 * Reads one file out of a zip, and only that one.
 *
 * The directory says where an entry's header is, but not where its bytes are: the header carries a
 * name and an extra field of its own, both of any length, so where the data starts can only be
 * learnt by reading it. Two small reads and one inflate, whatever else the archive holds.
 *
 * @param path - The archive.
 * @param entry - The entry, as the directory listed it.
 * @returns The file's bytes, or nothing where the archive disagrees with its own directory.
 */
const readZipEntry = async (path: string, entry: ZipEntry): Promise<Uint8Array | null> => {
  const file = await open(path, 'r').catch(() => null);

  if (file === null) {
    return null;
  }

  try {
    const header = Buffer.alloc(LOCAL_MINIMUM);

    await file.read(header, 0, LOCAL_MINIMUM, entry.headerOffset);

    const reading = new DataView(header.buffer, header.byteOffset, header.byteLength);

    if (reading.getUint32(0, true) !== LOCAL_FILE_HEADER) {
      return null;
    }

    const at =
      entry.headerOffset +
      LOCAL_MINIMUM +
      reading.getUint16(26, true) +
      reading.getUint16(28, true);

    const packed = Buffer.alloc(entry.compressedSize);

    await file.read(packed, 0, entry.compressedSize, at);

    if (!entry.isCompressed) {
      return new Uint8Array(packed);
    }

    return inflateSync(new Uint8Array(packed), { out: new Uint8Array(entry.uncompressedSize) });
  } catch {
    return null;
  } finally {
    await file.close();
  }
};

export { readZipEntry };
