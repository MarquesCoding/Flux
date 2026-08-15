import { createReachabilityWatch } from './createReachabilityWatch';
import type { DiskUse } from '@FluxServer/maintenance/DiskUse';

type CreateDiskPressureWatchOptions = {
  onLow: (disk: DiskUse) => void;
  onRecovered: (disk: DiskUse) => void;
};

/**
 * Watches every filesystem Flux writes to, and speaks up when one crosses.
 *
 * A watch apiece, kept by mount point, because the machines are independent:
 * an array that has been full for a week must not silence the first warning
 * about the disk Postgres lives on. Made on first sight of a mount rather
 * than up front, since which filesystems exist is something the monitor says
 * and not something Flux is told.
 *
 * The transition logic is `createReachabilityWatch`, unchanged. Having room
 * and being reachable are the same shape of fact — true or false, checked
 * over and over, interesting only when it changes — and a second
 * implementation of "announce once per crossing" would be a second place for
 * it to be got wrong.
 *
 * A mount that stops being reported is left alone rather than treated as
 * recovered. A disk that vanished between readings has not been fixed; it has
 * been unmounted, which is its own problem and not one to send an all-clear
 * about.
 *
 * `record` takes one reading of the lot: `low` is what is under pressure now,
 * and `seen` is everything, so a mount that has recovered is recorded as such
 * rather than missed for never appearing in `low`.
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
