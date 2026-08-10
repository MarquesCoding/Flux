import QualityStepModule from '@FluxContracts/schemas/QualityStep'
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep'
import type { MediaItem } from '@FluxContracts/schemas/MediaItem'

const { QUALITY_STEPS } = QualityStepModule

/**
 * Which quality steps are worth offering for a source.
 *
 * Only steps strictly below the source's own height are included, so the
 * menu never offers an upscale — the source's true resolution is always
 * reached through Original instead.
 */
const listAvailableQualitySteps = (media: MediaItem): QualityStepId[] =>
  QUALITY_STEPS.filter((step) => step.maxHeight < media.height).map((step) => step.id)

export default { listAvailableQualitySteps }
