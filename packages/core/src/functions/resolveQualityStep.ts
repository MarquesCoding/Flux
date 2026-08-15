import {
  QUALITY_STEPS,
  COMPRESSED_AUDIO_THRESHOLD_HEIGHT,
  COMPRESSED_AUDIO_MAX_BITRATE_KBPS,
} from '@FluxContracts/schemas/QualityStep';
import type { QualityStepId } from '@FluxContracts/schemas/QualityStep';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';

type QualityClamp = {
  maxWidth: number;
  maxHeight: number;
  maxVideoBitrateKbps: number;
  maxAudioBitrateKbps: number | null;
};

/**
 * Resolves a requested quality step against a source into a clamp, or `null` when no clamp should
 * apply.
 */
const resolveQualityStep = (
  media: MediaItem,
  requested: QualityStepId | 'original',
): QualityClamp | null => {
  if (requested === 'original') {
    return null;
  }

  const step = QUALITY_STEPS.find((entry) => entry.id === requested);

  if (step === undefined) {
    return null;
  }

  if (media.height <= step.maxHeight && media.bitrateKbps <= step.maxVideoBitrateKbps) {
    return null;
  }

  return {
    maxWidth: step.maxWidth,
    maxHeight: step.maxHeight,
    maxVideoBitrateKbps: step.maxVideoBitrateKbps,
    maxAudioBitrateKbps:
      step.maxHeight < COMPRESSED_AUDIO_THRESHOLD_HEIGHT ? COMPRESSED_AUDIO_MAX_BITRATE_KBPS : null,
  };
};

export type { QualityClamp };

export { resolveQualityStep };
