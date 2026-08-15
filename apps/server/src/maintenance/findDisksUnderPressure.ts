import type { DiskUse } from './DiskUse';

const LOW_DISK_FRACTION = 0.05;

const LOW_DISK_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Whether a filesystem is close enough to full to be worth saying so.
 *
 * @param disk One mounted filesystem as the media service measured it.
 */
const isUnderPressure = (disk: DiskUse): boolean => {
  if (disk.totalBytes === 0) {
    return false;
  }

  return (
    disk.availableBytes < LOW_DISK_BYTES ||
    disk.availableBytes / disk.totalBytes < LOW_DISK_FRACTION
  );
};

/**
 * Which mount a path is stored on.
 *
 * @param path Somewhere Flux writes.
 * @param disks Every filesystem the machine reported.
 */
const findMountFor = (path: string, disks: DiskUse[]): DiskUse | null =>
  disks
    .filter((disk) => {
      const within = disk.mountPoint.endsWith('/') ? disk.mountPoint : `${disk.mountPoint}/`;

      return path === disk.mountPoint || path.startsWith(within);
    })
    .sort((one, other) => other.mountPoint.length - one.mountPoint.length)[0] ?? null;

/**
 * The filesystems Flux writes to that are running out of room.
 *
 * @param paths Everywhere Flux writes: the libraries, and its caches.
 * @param disks Every filesystem the machine reported.
 */
const findDisksUnderPressure = (paths: string[], disks: DiskUse[]): DiskUse[] => {
  const used = new Map<string, DiskUse>();

  for (const path of paths) {
    const mount = findMountFor(path, disks);

    if (mount !== null && isUnderPressure(mount)) {
      used.set(mount.mountPoint, mount);
    }
  }

  return [...used.values()];
};

export { findDisksUnderPressure, findMountFor, isUnderPressure, LOW_DISK_BYTES, LOW_DISK_FRACTION };
