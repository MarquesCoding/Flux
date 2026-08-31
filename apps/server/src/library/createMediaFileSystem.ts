import { readdir, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaFileSystem, ScannedFile } from './scanLibrary';

const MAX_DEPTH = 12;

/**
 * Walks a library root and everything below it, gathering the files worth considering with their
 * sizes and modification times — the two facts a scan uses to decide what has changed.
 *
 * @param root - Where to start.
 * @param depth - How far down this walk already is.
 * @param seen - The directories already walked, by the real path each resolves to.
 * @returns Every file found, with what the scan needs to know about it.
 */
const walk = async (root: string, depth: number, seen: Set<string>): Promise<ScannedFile[]> => {
  if (depth > MAX_DEPTH) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: ScannedFile[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkInto(path, depth + 1, seen)));

      continue;
    }

    const details = await stat(path).catch(() => null);

    if (details === null) {
      continue;
    }

    if (details.isDirectory()) {
      files.push(...(await walkInto(path, depth + 1, seen)));

      continue;
    }

    if (!details.isFile()) {
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
 * Walks a directory unless this walk has been through it already, which is what stops a link
 * pointing back up its own tree from being followed round for ever. Two links to one directory read
 * it once, under whichever name was reached first.
 *
 * @param path - The directory to walk, as it was reached.
 * @param depth - How far down the walk this directory sits.
 * @param seen - The directories already walked, by the real path each resolves to.
 * @returns Every file below it, or none where it has been walked already.
 */
const walkInto = async (path: string, depth: number, seen: Set<string>): Promise<ScannedFile[]> => {
  const real = await realpath(path).catch(() => null);

  if (real === null || seen.has(real)) {
    return [];
  }

  seen.add(real);

  return walk(path, depth, seen);
};

/**
 * The real filesystem, as the scanner uses it. Kept behind an interface so a scan can be tested
 * against a directory tree described in a test rather than one that has to exist on disk.
 */
const createMediaFileSystem = (): MediaFileSystem => ({
  listFiles: (root) => walkInto(root, 0, new Set()),
});

export { createMediaFileSystem };
