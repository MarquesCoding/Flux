import { QUALITY_STEPS } from '@FluxContracts/schemas/QualityStep';
import { resolveQualityStep } from '@FluxCore/functions/resolveQualityStep';
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';

/**
 * Lists the quality steps worth offering for a particular file.
 *
 * A rung is worth offering when it is within reach of the source and would actually change what
 * gets sent. Those are two questions, and this used to ask only the first — strictly below the
 * source's height — on the reasoning that a step at the source's own size delivers nothing.
 *
 * That is true of resolution and false of bitrate, which is the other half of what a rung is. A
 * 1080p remux at thirty megabits offered at 1080p goes out at four and a half: the same picture on
 * a seventh of the bandwidth, which is the difference between playing and buffering on a poor
 * connection. Withholding it left a viewer whose line could not carry the remux choosing between
 * the original and 720p, when the thing they wanted existed and worked.
 *
 * Within reach means either dimension, not height alone. A rung is a box, and a film shot in scope
 * fills the width of its class while falling well short of the height: Charlie's Angels is
 * 1920x800, which is a 1080p file by any reading a viewer would give it, and 1080 is not under 800.
 * Judged on height it lost the rung matching its own resolution and was offered 720p as the best it
 * could do. Judged on either, it keeps 1080p and still cannot reach for 1440p, which it has neither
 * the width nor the height for.
 *
 * Whether a rung changes anything is asked of [`resolveQualityStep`] rather than worked out again
 * here, so the picker offers exactly what the server will act on. A rung that would be refused as a
 * no-op never appears — a source already inside a rung's ceiling still does not show it.
 *
 * @param media - The file being played.
 * @returns The identifiers of the steps worth offering, largest first.
 */
const listAvailableQualitySteps = (media: MediaItem): QualityStepId[] =>
  QUALITY_STEPS.filter(
    (step) =>
      (step.maxWidth <= media.width || step.maxHeight <= media.height) &&
      resolveQualityStep(media, step.id) !== null,
  ).map((step) => step.id);

export { listAvailableQualitySteps };
