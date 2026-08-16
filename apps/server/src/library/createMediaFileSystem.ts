import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaFileSystem, ScannedFile } from './scanLibrary';

const MAX_DEPTH = 12;

/**
 * Walks a library root and everything below it, gathering the files worth considering with their
 * sizes and modification times — the two facts a scan uses to decide what has changed. Stops at a
 * depth, since a symlink loop would otherwise walk for ever.
 *
 * @param root - Where to start.
 * @param depth - How far down this walk already is.
 * @returns Every file found, with what the scan needs to know about it.
 */
const walk = async (root: string, depth: number): Promise<ScannedFile[]> => {
  if (depth > MAX_DEPTH) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: ScannedFile[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(path, depth + 1)));

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const details = await stat(path).catch(() => null);

    if (details === null) {
      continue;
    }

    files.push({
      path,
      sizeBytes: details.size,
      modifiedAtMs: Math.floor(details.mtimeMs),
    });
  }

  return files;
};

/**
 * The real filesystem, as the scanner uses it. Kept behind an interface so a scan can be tested
 * against a directory tree described in a test rather than one that has to exist on disk.
 */
const createMediaFileSystem = (): MediaFileSystem => ({
  listFiles: (root) => walk(root, 0),
});

export { createMediaFileSystem };
