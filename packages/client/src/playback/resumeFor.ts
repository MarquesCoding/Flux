import { isWorthResuming } from '@FluxContracts/schemas/WatchProgress';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

/**
 * Where this viewer left an item, when it is worth offering to come back to.
 *
 * @param progress - What is known about how far they have got in everything.
 * @param mediaId - The item being asked about.
 * @returns The position to offer, or null when carrying on is not worth suggesting.
 */
const resumeFor = (
  progress: ReadonlyMap<string, WatchProgress>,
  mediaId: string,
): number | null => {
  const found = progress.get(mediaId);

  return found !== undefined && isWorthResuming(found) ? found.positionSeconds : null;
};

export { resumeFor };
