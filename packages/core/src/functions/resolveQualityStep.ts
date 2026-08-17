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

const LADDER_FRAME_RATE = 30;

const HIGH_FRAME_RATE_ALLOWANCES = [
  { aboveFps: 48, factor: 1.4 },
  { aboveFps: LADDER_FRAME_RATE, factor: 1.2 },
] as const;

/**
 * How much of the ladder's ceiling high frame rate content is allowed on top.
 *
 * The ladder's numbers are standard frame rate, as its own doc comment says, and sixty frames a
 * second needs meaningfully more bits than twenty-four for the same picture. Held to the ladder's
 * figure regardless, that content is not clamped so much as starved — and it is starved by an
 * assumption nobody stated at the point of choosing.
 *
 * Not proportional. Doubling the frames does not double what they cost, because consecutive frames
 * at high rates are more alike and so cheaper to predict from each other.
 *
 * @param frameRate - The source's frame rate, where it is known.
 * @returns The multiplier for the ceiling, one where the rate is standard or unknown.
 */
const frameRateAllowance = (frameRate: number | null | undefined): number => {
  if (typeof frameRate !== 'number' || !Number.isFinite(frameRate)) {
    return 1;
  }

  return HIGH_FRAME_RATE_ALLOWANCES.find((step) => frameRate > step.aboveFps)?.factor ?? 1;
};

/**
 * Turns a viewer's chosen quality into the ceiling the negotiator should work under, given what the
 * file actually is. Asking for the original, or for a step this file cannot honour, comes back as
 * no ceiling at all rather than as an error — a request that cannot be met should leave playback
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

  const maxVideoBitrateKbps = Math.round(
    step.maxVideoBitrateKbps * frameRateAllowance(media.videoFrameRate),
  );

  if (media.height <= step.maxHeight && media.bitrateKbps <= maxVideoBitrateKbps) {
    return null;
  }

  return {
    maxWidth: step.maxWidth,
    maxHeight: step.maxHeight,
    maxVideoBitrateKbps,
    maxAudioBitrateKbps:
      step.maxHeight < COMPRESSED_AUDIO_THRESHOLD_HEIGHT ? COMPRESSED_AUDIO_MAX_BITRATE_KBPS : null,
  };
};

export type { QualityClamp };

export { resolveQualityStep, frameRateAllowance };
