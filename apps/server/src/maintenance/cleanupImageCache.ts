import { join } from 'node:path';

/**
 * The cache directories as cleanup sees them.
 *
 * `list` answers with file names only, never subdirectories — a real
 * implementation excludes them, so a job walking the top-level cache
 * directory never has to know its `profiles` subdirectory lives inside it.
 */
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
  /**
   * The same hash a read builds a cache file's name from — reused rather
   * than reimplemented, so a cleanup that disagrees with the cache about its
   * own naming scheme is not possible.
   */
  nameFor: (url: string) => string;
  listMediaImageUrls: () => Promise<MediaImageUrls[]>;
  listProfilePhotoPaths: () => Promise<(string | null)[]>;
  onProblem?: (path: string, reason: string) => void;
  /**
   * `phase` tells the two directories apart, the same way a scan's phases
   * tell probing apart from previews — the cache is swept first, then
   * profile photos, and each restarts its own count rather than continuing
   * the other's total.
   */
  onProgress?: (phase: 'cache' | 'profiles', processed: number, total: number) => void;
};

const baseName = (path: string): string => path.split('/').pop() ?? path;

/**
 * Removes every file in a directory that nothing valid still points at.
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
 * Deletes every cached artwork and profile photo file nothing in the
 * database references any more.
 *
 * A cache file survives the media item or profile it was fetched for by
 * design — deleting an item does not walk the filesystem — so this is the
 * only thing that ever reclaims that space. Orphaned rows are not swept
 * here on purpose: every table a cached image could belong to cascades on
 * delete already, so there is never a row this could find that Postgres
 * has not already removed.
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
