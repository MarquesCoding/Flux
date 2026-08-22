import { formatBytes } from '@FluxCore/functions/formatBytes';
import type { FluxMemoryUse } from './fluxMemoryUse';

/**
 * Says how much memory Flux is holding, naming what the figure actually covers so that a reading of
 * one process out of two is not read as the whole of Flux. Where the deployment can be seen it is
 * Flux; where only the media service and its conversions can be, it says so.
 *
 * @param use - What Flux is using, or null where it could not be worked out.
 * @returns The phrase to show.
 */
const describeFluxMemory = (use: FluxMemoryUse | null): string => {
  if (use === null) {
    return 'Flux not measured';
  }

  const subject = use.scope === 'deployment' ? 'Flux' : 'media service';

  return `${subject} ${formatBytes(use.usedBytes)}`;
};

export { describeFluxMemory };
