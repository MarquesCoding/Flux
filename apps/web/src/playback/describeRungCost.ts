const KBPS_IN_MBPS = 1000;

const BYTES_IN_GB = 1e9;

const BYTES_IN_MB = 1e6;

type DescribeRungCostOptions = {
  maxBitrateKbps: number;
  durationSeconds: number;
  isCeiling?: boolean;
};

/**
 * Says what a rung costs, in the two units a viewer actually reasons in.
 *
 * The bitrate is what decides whether a stream keeps up on the line it is being pulled down, and
 * the size is what decides whether it is worth pulling at all. Most people have an intuition for
 * one of those and not the other, so both are offered rather than picking a favourite.
 *
 * A rung caps the bitrate rather than aiming at it, so it is written as a ceiling and a well
 * compressed film comes in under the number. The original is not a ceiling — it is simply what the
 * file is — so `isCeiling` turns that off and the figure is given plainly. Saying "up to" of a file
 * that already exists would be a hedge against nothing.
 *
 * The size is approximate either way. Nothing here records how large a file is on disk, so it is
 * derived from the bitrate and the runtime, which lands close but is not the number a directory
 * listing would give.
 *
 * @param options - The bitrate, how long the film runs, and whether the bitrate is a cap.
 * @returns The cost as a phrase, or the bitrate alone where the runtime is not known.
 */
const describeRungCost = ({
  maxBitrateKbps,
  durationSeconds,
  isCeiling = true,
}: DescribeRungCostOptions): string => {
  const prefix = isCeiling ? 'up to ' : '';

  const rate =
    maxBitrateKbps >= KBPS_IN_MBPS
      ? `${prefix}${(maxBitrateKbps / KBPS_IN_MBPS).toFixed(1)} Mbps`
      : `${prefix}${maxBitrateKbps.toString()} kbps`;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return rate;
  }

  const bytes = (maxBitrateKbps * KBPS_IN_MBPS * durationSeconds) / 8;

  const size =
    bytes >= BYTES_IN_GB
      ? `${(bytes / BYTES_IN_GB).toFixed(1)} GB`
      : `${Math.round(bytes / BYTES_IN_MB).toString()} MB`;

  return `${rate} · ~${size}`;
};

export type { DescribeRungCostOptions };

export { describeRungCost };
