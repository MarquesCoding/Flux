import type { VideoCodec } from '@FluxContracts/schemas/MediaItem';

type EncodeBitrateOptions = {
  sourceBitrateKbps: number;
  sourceCodec: VideoCodec;
  targetCodec: VideoCodec;
  ceilingKbps: number;
};

const EFFICIENCY: Partial<Record<VideoCodec, number>> = {
  hevc: 0.6,
  vp9: 0.6,
  av1: 0.5,
};

const LOW_BITRATE_FLOORS = [
  { atOrBelowKbps: 500, factor: 4 },
  { atOrBelowKbps: 1_000, factor: 3 },
  { atOrBelowKbps: 2_000, factor: 2.5 },
  { atOrBelowKbps: 3_000, factor: 2 },
] as const;

const NO_SCALING_ABOVE_KBPS = 30_000;

const STARVED_SOURCE_BOOSTS = [
  { atOrBelowKbps: 2_000, factor: 2.5 },
  { atOrBelowKbps: 3_000, factor: 2 },
] as const;

/**
 * How many bits a codec needs for a given picture, against H.264 as one.
 *
 * HEVC and VP9 reach the same quality on about sixty percent of the bits, and AV1 on about half.
 * Anything older than H.264 needs more rather than fewer, but claiming that would push encodes
 * above the source for no visible gain, so they are treated as equal.
 *
 * @param codec - The codec to weigh.
 * @returns Its share of H.264's bitrate for the same picture.
 */
const efficiencyOf = (codec: VideoCodec): number => EFFICIENCY[codec] ?? 1;

/**
 * What bitrate to encode at, given what the source spends and what the client will take.
 *
 * Two decisions, in order, and the order is what makes it right.
 *
 * First the target is anchored to the **source** rather than to the client's ceiling. A client
 * saying it can take twenty megabits is saying what it can carry, not what the film is worth:
 * re-encoding a nine megabit source at twenty spends more than double the bits on a picture that
 * cannot improve, because the detail was already thrown away by whoever made the file. A source
 * poor enough to be starved by this is boosted instead, since a two megabit file re-encoded at two
 * megabits comes out visibly worse than it went in.
 *
 * Then the anchor is **scaled for the codec being encoded to**. This is the part that a plain
 * clamp gets wrong: H.264 genuinely needs more bits than HEVC for the same picture, so handing it
 * the HEVC source's own bitrate guarantees a worse image. Going up is allowed, going down never
 * is, and above thirty megabits nothing is scaled at all — the gain stops being visible and the
 * cost starts overwhelming decoders.
 *
 * Finally the result is held to the client's ceiling, which is where this departs from the model
 * it follows: a ceiling exists because a device or a network cannot take more, so it is not
 * something an efficiency calculation gets to overrule.
 *
 * @param options - What the source spends, what is being encoded to, and what the client allows.
 * @returns The bitrate to encode at, in kbps.
 */
const encodeBitrateFor = ({
  sourceBitrateKbps,
  sourceCodec,
  targetCodec,
  ceilingKbps,
}: EncodeBitrateOptions): number => {
  if (!Number.isFinite(sourceBitrateKbps) || sourceBitrateKbps <= 0) {
    return ceilingKbps;
  }

  const boost =
    STARVED_SOURCE_BOOSTS.find((step) => sourceBitrateKbps <= step.atOrBelowKbps)?.factor ?? 1;

  const anchored = Math.min(sourceBitrateKbps * boost, ceilingKbps);

  const byCodec = Math.max(efficiencyOf(targetCodec) / efficiencyOf(sourceCodec), 1);

  const floor = LOW_BITRATE_FLOORS.find((step) => anchored <= step.atOrBelowKbps)?.factor ?? 1;

  const scale = anchored >= NO_SCALING_ABOVE_KBPS ? 1 : Math.max(byCodec, floor);

  return Math.min(Math.round(anchored * scale), ceilingKbps);
};

export type { EncodeBitrateOptions };

export { encodeBitrateFor, efficiencyOf };
