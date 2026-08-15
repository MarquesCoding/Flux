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
 * Turns a viewer's chosen quality into the ceiling the negotiator should work under, given what the
 * file actually is. Asking for the original, or for a step this file cannot honour, comes back as no
 * ceiling at all rather than as an error — a request that cannot be met should leave playback
 * exactly as it would have been.
 *
 * @param media - The file being played.
 * @param requested - The step a viewer chose, or `original` to accept the file as it is.
 * @returns The ceiling to encode under, or null where the file should be left alone.
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
