import { createReachabilityWatch } from './createReachabilityWatch';
import type { DiskUse } from '@ValenceServer/maintenance/DiskUse';

type CreateDiskPressureWatchOptions = {
  onLow: (disk: DiskUse) => void;
  onRecovered: (disk: DiskUse) => void;
};

/**
 * Watches every filesystem Valence writes to, and speaks up when one crosses.
 *
 * @param onLow Called once, when a filesystem crosses into running out.
 * @param onRecovered Called once, when one that was low has room again.
 */
const createDiskPressureWatch = ({ onLow, onRecovered }: CreateDiskPressureWatchOptions) => {
  const watches = new Map<string, ReturnType<typeof createReachabilityWatch>>();
  const lastSeen = new Map<string, DiskUse>();

  const watchFor = (mountPoint: string) => {
    const held = watches.get(mountPoint);

    if (held !== undefined) {
      return held;
    }

    const made = createReachabilityWatch({
      onLost: () => {
        const disk = lastSeen.get(mountPoint);

        if (disk !== undefined) {
          onLow(disk);
        }
      },
      onRegained: () => {
        const disk = lastSeen.get(mountPoint);

        if (disk !== undefined) {
          onRecovered(disk);
        }
      },
    });

    watches.set(mountPoint, made);

    return made;
  };

  return {
    record: (seen: DiskUse[], low: DiskUse[]): void => {
      const isLow = new Set(low.map((disk) => disk.mountPoint));

      for (const disk of seen) {
        lastSeen.set(disk.mountPoint, disk);
        watchFor(disk.mountPoint).record(!isLow.has(disk.mountPoint));
      }
    },
  };
};

export { createDiskPressureWatch };
