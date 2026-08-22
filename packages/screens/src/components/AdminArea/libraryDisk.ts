import type { Monitor } from '@ValenceClient/admin/fetchAdmin';

type DiskUse = Monitor['resources']['disks'][number];

/**
 * Decides whether a path sits on a mount point, matching on path boundaries so that `/mnt/media2` is
 * not taken to be inside `/mnt/media`.
 *
 * @param mountPoint - The mount point.
 * @param path - The path in question.
 * @returns Whether the path is on it.
 */
const holds = (mountPoint: string, path: string): boolean => {
  if (path === mountPoint) {
    return true;
  }

  return path.startsWith(mountPoint.endsWith('/') ? mountPoint : `${mountPoint}/`);
};

/**
 * Picks the one filesystem worth reporting for a set of libraries: of the disks holding any of them,
 * the one with the least room left. Libraries can be spread over several mounts, and the one about
 * to run out is the only one anybody needs telling about. Where a path sits under nested mounts, the
 * deepest is the one it is actually on.
 *
 * @param disks - The filesystems the monitor knows about.
 * @param paths - Where the libraries live.
 * @returns The filesystem to report, or null where none of them can be placed on one.
 */
const libraryDisk = (disks: DiskUse[], paths: string[]): DiskUse | null => {
  const holding = paths.flatMap((path) => {
    const candidates = disks.filter((disk) => holds(disk.mountPoint, path));

    return candidates.reduce<DiskUse[]>(
      (deepest, disk) =>
        deepest[0] === undefined || disk.mountPoint.length > deepest[0].mountPoint.length
          ? [disk]
          : deepest,
      [],
    );
  });

  return holding.reduce<DiskUse | null>(
    (tightest, disk) =>
      tightest === null || disk.availableBytes < tightest.availableBytes ? disk : tightest,
    null,
  );
};

export { libraryDisk };
export type { DiskUse };
