import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaFileSystem, ScannedFile } from './scanLibrary';

const MAX_DEPTH = 12;

/**
 * Walks a library root.
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
 * The real filesystem, for the scanner.
 */
const createMediaFileSystem = (): MediaFileSystem => ({
  listFiles: (root) => walk(root, 0),
});

export { createMediaFileSystem };
