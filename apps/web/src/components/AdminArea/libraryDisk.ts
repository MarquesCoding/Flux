import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

type DiskUse = Monitor['resources']['disks'][number];

/**
 * Whether a path sits on a mount point.
 *
 * Compared a directory at a time rather than as text, because `/media` does
 * not hold `/mediatemp` however much the two look alike at the start.
 */
const holds = (mountPoint: string, path: string): boolean => {
  if (path === mountPoint) {
    return true;
  }

  return path.startsWith(mountPoint.endsWith('/') ? mountPoint : `${mountPoint}/`);
};

/**
 * The filesystem to report for a set of libraries, and nothing if none of them
 * can be placed on one.
 *
 * A path can sit under several mount points at once — everything is under `/`
 * — so the deepest one wins, which is the filesystem the files are actually
 * written to rather than the one it happens to be nested inside.
 *
 * Libraries spread across several disks give several answers, and the one
 * worth the single figure on the strip is the one with the least room left:
 * that is the one that stops the service, and the others are not yet anybody's
 * problem.
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
