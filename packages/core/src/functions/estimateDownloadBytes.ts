import { QUALITY_STEPS } from '@ValenceContracts/schemas/QualityStep';
import type { DownloadQuality } from '@ValenceContracts/schemas/Download';

const BITS_IN_A_KILOBIT = 1000;

const BITS_IN_A_BYTE = 8;

type EstimateDownloadBytesOptions = {
  quality: DownloadQuality;
  durationSeconds: number;
  sizeBytes: number;
};

/**
 * How large a download would be, in bytes.
 *
 * The original is not estimated. Its size is recorded on the item, and quoting a guess for a file
 * that already exists would be worse than the number nobody had to derive.
 *
 * A rung is estimated from its bitrate ceiling and the runtime, which lands high: an encoder rarely
 * spends its whole allowance on simple footage, so the finished file usually comes in under. That
 * is the direction to be wrong in. Somebody told four gigabytes who receives three is pleased;
 * somebody told three who receives four has hit the exact problem the figure exists to prevent.
 *
 * @param options - Which rung, how long it runs, and how large the source is.
 * @returns The size in bytes, or nothing where the rung is not one this knows.
 */
const estimateDownloadBytes = ({
  quality,
  durationSeconds,
  sizeBytes,
}: EstimateDownloadBytesOptions): number | null => {
  if (quality === 'original') {
    return sizeBytes > 0 ? sizeBytes : null;
  }

  const step = QUALITY_STEPS.find((one) => one.id === quality);

  if (step === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Math.round(
    (step.maxVideoBitrateKbps * BITS_IN_A_KILOBIT * durationSeconds) / BITS_IN_A_BYTE,
  );
};

export type { EstimateDownloadBytesOptions };

export { estimateDownloadBytes };
