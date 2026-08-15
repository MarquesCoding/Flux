import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

type DiskUse = Monitor['resources']['disks'][number];

/**
 * Whether a path sits on a mount point.
 */
const holds = (mountPoint: string, path: string): boolean => {
  if (path === mountPoint) {
    return true;
  }

  return path.startsWith(mountPoint.endsWith('/') ? mountPoint : `${mountPoint}/`);
};

/**
 * The filesystem to report for a set of libraries, and nothing if none of them can be placed on
 * one.
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
