import { QUALITY_STEPS } from '@FluxContracts/schemas/QualityStep';
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';

/**
 * Lists the quality steps worth offering for a particular file: those below its own height, since a
 * step at or above the source would be asking the server to work in order to deliver nothing. A
 * viewer choosing between these is always choosing to go down.
 *
 * @param media - The file being played, whose height decides what is worth offering.
 * @returns The identifiers of the steps below the source, largest first.
 */
const listAvailableQualitySteps = (media: MediaItem): QualityStepId[] =>
  QUALITY_STEPS.filter((step) => step.maxHeight < media.height).map((step) => step.id);

export { listAvailableQualitySteps };
