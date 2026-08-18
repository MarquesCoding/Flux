import type { VideoCodec } from '@FluxContracts/schemas/MediaItem';

type EncodeBitrateOptions = {
  sourceBitrateKbps: number;
  sourceCodec: VideoCodec;
  targetCodec: VideoCodec;
  ceilingKbps: number | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
};

type PictureSize = {
  sourceWidth: number | null | undefined;
  sourceHeight: number | null | undefined;
  maxWidth: number | null | undefined;
  maxHeight: number | null | undefined;
};

const PIXEL_EXPONENT = 0.75;

/**
 * A dimension worth doing arithmetic with, or nothing.
 *
 * @param value - The dimension as it arrived, which may be absent for a file that predates knowing.
 * @returns The dimension, or null where it cannot be used.
 */
const usableSize = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

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

const UNKNOWN_SOURCE_KBPS = 20_000;

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
 * What share of the source's bitrate a smaller picture is worth.
 *
 * Downscaling is not neutral and not linear either. Half the width and height is a quarter of the
 * pixels, but nothing like a quarter of the bits: shrinking averages out grain and sensor noise,
 * so the picture that arrives is easier to compress than the one that left. Bits track pixels
 * raised to about three quarters, which puts a 4K source delivered at 1080p near a third of what
 * it spent — close to where published ladders sit for the same pair.
 *
 * Anything that is not a reduction returns one. Upscaling earns no extra bits, because the detail
 * to spend them on is not there.
 *
 * @param options - The source's size, and the box the output has to fit inside.
 * @returns The multiplier to apply to the source's bitrate, at most one.
 */
const downscaleShare = ({
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
}: PictureSize): number => {
  const width = usableSize(sourceWidth);
  const height = usableSize(sourceHeight);
  const boxWidth = usableSize(maxWidth);
  const boxHeight = usableSize(maxHeight);

  if (width === null || height === null || boxWidth === null || boxHeight === null) {
    return 1;
  }

  const scale = Math.min(1, boxWidth / width, boxHeight / height);

  return (scale * scale) ** PIXEL_EXPONENT;
};

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
 * Only then is the answer **scaled for the size being delivered**, and the order matters as much
 * here as anywhere. Whether a source is starved, and whether it is too poor to encode at its own
 * bitrate, are questions about the file rather than about the output: a well made 4K file at four
 * and a half megabits is not starved, and treating the smaller picture's share as though it were
 * would boost it straight back to where it started, which is the exact fault this is here to fix.
 * So the size discount is taken last, on a figure that already reflects what the source is worth.
 *
 * Finally the result is held to the client's ceiling where there is one, which is where this
 * departs from the model it follows: a ceiling exists because a device or a network cannot take
 * more, so it is not something an efficiency calculation gets to overrule. It is applied once, at
 * the end, and only there — a ceiling is already a figure for the size being delivered, so
 * discounting against it a second time charges the same reduction twice and lands somewhere nobody
 * would choose. Nothing states one by default, and the figure anchored to the source stands on its
 * own where nothing does.
 *
 * @param options - What the source spends, what is being encoded to, and what the client allows,
 *   where it says.
 * @returns The bitrate to encode at, in kbps.
 */
const encodeBitrateFor = ({
  sourceBitrateKbps,
  sourceCodec,
  targetCodec,
  ceilingKbps,
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
}: EncodeBitrateOptions): number => {
  if (!Number.isFinite(sourceBitrateKbps) || sourceBitrateKbps <= 0) {
    return ceilingKbps ?? UNKNOWN_SOURCE_KBPS;
  }

  const boost =
    STARVED_SOURCE_BOOSTS.find((step) => sourceBitrateKbps <= step.atOrBelowKbps)?.factor ?? 1;

  const anchored = sourceBitrateKbps * boost;

  const byCodec = Math.max(efficiencyOf(targetCodec) / efficiencyOf(sourceCodec), 1);

  const floor = LOW_BITRATE_FLOORS.find((step) => anchored <= step.atOrBelowKbps)?.factor ?? 1;

  const scale = anchored >= NO_SCALING_ABOVE_KBPS ? 1 : Math.max(byCodec, floor);

  const forSource = anchored * scale;

  const forDelivery = Math.round(
    forSource * downscaleShare({ sourceWidth, sourceHeight, maxWidth, maxHeight }),
  );

  return ceilingKbps === null ? forDelivery : Math.min(forDelivery, ceilingKbps);
};

export type { EncodeBitrateOptions };

export { encodeBitrateFor, efficiencyOf, downscaleShare };
