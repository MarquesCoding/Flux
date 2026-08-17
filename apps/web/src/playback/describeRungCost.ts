const KBPS_IN_MBPS = 1000;

const BYTES_IN_GB = 1e9;

const BYTES_IN_MB = 1e6;

type DescribeRungCostOptions = {
  maxBitrateKbps: number;
  durationSeconds: number;
};

/**
 * Says what a rung costs, in the two units a viewer actually reasons in.
 *
 * The bitrate is what decides whether a stream keeps up on the line it is being pulled down, and
 * the size is what decides whether it is worth pulling at all. Most people have an intuition for
 * one of those and not the other, so both are offered rather than picking a favourite.
 *
 * Both are ceilings and are written as such. A rung caps the bitrate rather than aiming at it, so
 * a well compressed film comes in under the number, and the size follows from the same figure.
 *
 * @param options - The rung's ceiling and how long the film runs.
 * @returns The cost as a phrase, or the bitrate alone where the runtime is not known.
 */
const describeRungCost = ({ maxBitrateKbps, durationSeconds }: DescribeRungCostOptions): string => {
  const rate =
    maxBitrateKbps >= KBPS_IN_MBPS
      ? `up to ${(maxBitrateKbps / KBPS_IN_MBPS).toFixed(1)} Mbps`
      : `up to ${maxBitrateKbps.toString()} kbps`;

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
