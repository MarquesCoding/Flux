import type { DiskUse } from './DiskUse';

/**
 * How little room is left before Flux says something.
 *
 * Two thresholds, and a disk trips on whichever it reaches first, because
 * neither one alone works across the range of machines Flux runs on. Five per
 * cent of a 20TB array is a terabyte and not an emergency; five per cent of a
 * 250GB boot disk is about to stop a transcode. An absolute floor catches the
 * small disk, a fraction catches the large one.
 */
const LOW_DISK_FRACTION = 0.05;

const LOW_DISK_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Whether a filesystem is close enough to full to be worth saying so.
 *
 * A disk reporting no size at all is not under pressure. That reading comes
 * from pseudo-filesystems the machine lists alongside real ones, and dividing
 * by it would make every one of them an emergency.
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
 * The longest mount point that the path begins with, because mounts nest: a
 * library at `/media/films` on a machine with both `/` and `/media` mounted
 * belongs to `/media`, and taking the first match would credit it to `/`.
 *
 * The separator is added only where the mount point does not already end in
 * one, so that root matches everything rather than looking for a path
 * beginning `//`. Comparing on the separator at all is what keeps
 * `/mediaserver` from being read as living under `/media`.
 *
 * Null where nothing matches, which on a normal machine cannot happen — `/`
 * is a prefix of everything — but a monitor that listed no filesystems would
 * otherwise have to be handled by every caller.
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
 * Scoped to the paths Flux actually uses rather than every mount the machine
 * has. A media server has a full disk somewhere most of the time — a read-only
 * install image, a snap loopback, somebody's backup drive — and warning about
 * those teaches an operator to ignore the warning that matters.
 *
 * Answered as one entry per mount rather than per path, because two libraries
 * on the same array are one problem and should not be two messages.
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
