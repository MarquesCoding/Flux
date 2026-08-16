import { join } from 'node:path';

type CacheFileSystem = {
  list: (directory: string) => Promise<string[]>;
  remove: (path: string) => Promise<void>;
};

type MediaImageUrls = {
  posterUrl: string | null;
  backdropUrl: string | null;
};

type CleanupImageCacheOptions = {
  imageCacheDir: string;
  profilesDir: string;
  files: CacheFileSystem;
  nameFor: (url: string) => string;
  listMediaImageUrls: () => Promise<MediaImageUrls[]>;
  listProfilePhotoPaths: () => Promise<(string | null)[]>;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (phase: 'cache' | 'profiles', processed: number, total: number) => void;
};

/**
 * Takes the filename off a path, since what the database points at is a name and what the sweep
 * walks is a directory of them.
 *
 * @param path - The path.
 * @returns Its last segment.
 */
const baseName = (path: string): string => path.split('/').pop() ?? path;

/**
 * Removes every file in a directory that nothing in the database points at any more, which is what
 * makes an artwork cache shrink when a library does. Reads what is referenced first and deletes
 * second, so a fetch happening mid-sweep is never deleted out from under itself.
 *
 * @param directory - The cache directory to sweep.
 * @param isValid - Whether a given filename is still pointed at.
 * @param files - How to list and remove files.
 * @param phase - Which sweep this is, for reporting progress.
 * @param onProgress - Called as files are worked through.
 * @param onProblem - Called with anything that could not be removed.
 * @returns How many files were removed, and how much disk they held.
 */
const sweep = async (
  directory: string,
  isValid: (fileName: string) => boolean,
  files: CacheFileSystem,
  phase: 'cache' | 'profiles',
  onProgress?: CleanupImageCacheOptions['onProgress'],
  onProblem?: CleanupImageCacheOptions['onProblem'],
): Promise<number> => {
  const names = await files.list(directory);
  let removed = 0;

  onProgress?.(phase, 0, names.length);

  for (const [index, name] of names.entries()) {
    if (!isValid(name)) {
      await files
        .remove(join(directory, name))
        .then(() => {
          removed += 1;
        })
        .catch((error: Error) => {
          onProblem?.(name, error.message);
        });
    }

    onProgress?.(phase, index + 1, names.length);
  }

  return removed;
};

/**
 * Deletes cached artwork and profile photographs that nothing references any more — the posters of
 * removed films, the faces of removed profiles. Artwork is fetched once and kept, so without this a
 * cache only ever grows.
 *
 * @param options - Where the cache is, and the database saying what is still referenced.
 * @returns What was removed, counted and measured.
 */
const cleanupImageCache = async ({
  imageCacheDir,
  profilesDir,
  files,
  nameFor,
  listMediaImageUrls,
  listProfilePhotoPaths,
  onProblem,
  onProgress,
}: CleanupImageCacheOptions): Promise<number> => {
  const media = await listMediaImageUrls();
  const validCacheNames = new Set<string>();

  for (const item of media) {
    if (item.posterUrl !== null) {
      validCacheNames.add(nameFor(item.posterUrl));
    }

    if (item.backdropUrl !== null) {
      validCacheNames.add(nameFor(item.backdropUrl));
    }
  }

  const cacheRemoved = await sweep(
    imageCacheDir,
    (name) => validCacheNames.has(name.endsWith('.type') ? name.slice(0, -'.type'.length) : name),
    files,
    'cache',
    onProgress,
    onProblem,
  );

  const photoPaths = await listProfilePhotoPaths();
  const validPhotoNames = new Set(
    photoPaths.filter((path): path is string => path !== null).map(baseName),
  );

  const profilesRemoved = await sweep(
    profilesDir,
    (name) => validPhotoNames.has(name),
    files,
    'profiles',
    onProgress,
    onProblem,
  );

  return cacheRemoved + profilesRemoved;
};

export type { CacheFileSystem, MediaImageUrls };

export { cleanupImageCache };
