import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { DirectoryRead, FolderDisk } from '@ValenceServer/folders/FolderDisk';

const MOUNT_PLACES = ['/Volumes', '/media', '/mnt', '/srv'] as const;

const DRIVE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Reads the code a filesystem error carries, such as `ENOENT`, where it carries one.
 *
 * @param error - What the filesystem threw.
 * @returns The code, or nothing.
 */
const codeOf = (error: Error): string | null =>
  'code' in error && typeof error.code === 'string' ? error.code : null;

/**
 * Says whether something is a folder, following a link to where it leads. Anything that cannot be
 * looked at is not a folder, as far as choosing one goes.
 *
 * @param path - What to look at.
 * @returns Whether it is a folder.
 */
const isFolderAt = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
};

/**
 * The machine's own disk, as the folder browser reads it: the names of what is in a folder, whether
 * something is a folder, and the places worth starting from.
 *
 * Those places are the top of the disk and the home folder of whoever runs Valence, and then
 * wherever drives are usually mounted — `/Volumes` on a Mac, `/media` and `/mnt` on Linux, `/srv`
 * on a server — where those exist. On Windows they are the drive letters that answer.
 *
 * A folder that is not there, or is a file, reads as missing; one that is there but will not be
 * read reads as unreadable — the difference between a typing mistake and a permission somebody has
 * to change.
 *
 * @param platform - Which operating system to pick starting places for, which a test replaces.
 * @returns The disk.
 */
const createFolderDisk = (platform: NodeJS.Platform = process.platform): FolderDisk => ({
  readDirectory: async (path): Promise<DirectoryRead> => {
    try {
      const entries = await readdir(path, { withFileTypes: true });

      return {
        kind: 'read',
        entries: entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isSymbolicLink: entry.isSymbolicLink(),
        })),
      };
    } catch (error) {
      const code = error instanceof Error ? codeOf(error) : null;

      return code === 'ENOENT' || code === 'ENOTDIR' ? { kind: 'missing' } : { kind: 'unreadable' };
    }
  },
  isDirectory: isFolderAt,
  roots: async () => {
    if (platform === 'win32') {
      const drives = await Promise.all(
        DRIVE_LETTERS.map(async (letter) => {
          const drive = `${letter}:\\`;

          return (await isFolderAt(drive)) ? [drive] : [];
        }),
      );

      return drives.flat();
    }

    const mounted = await Promise.all(
      MOUNT_PLACES.map(async (place) => ((await isFolderAt(place)) ? [place] : [])),
    );

    return [...new Set(['/', homedir(), ...mounted.flat()])];
  },
});

export { createFolderDisk };
