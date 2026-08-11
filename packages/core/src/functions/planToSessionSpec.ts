import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';

type VerifiedEncoder = {
  codec: string;
  encoder: string;
  accel: string;
};

type ToneMapping = 'zscale' | 'libplacebo' | 'unavailable';

type Capabilities = {
  encoders: VerifiedEncoder[];
  toneMapping?: ToneMapping;
  canBurnTextSubtitles?: boolean;
  canBurnImageSubtitles?: boolean;
};

type SessionSpec = {
  inputPath: string;
  startSeconds: number;
  segmentSeconds: number;
  hardwareAccel: string;
  video:
    | { kind: 'copy' }
    | {
        kind: 'encode';
        encoder: string;
        maxBitrateKbps: number;
        maxWidth: number;
        maxHeight: number;
        toneMap?: ToneMapping;
      };
  audio:
    | { kind: 'copy' }
    | { kind: 'encode'; encoder: string; channels: number; maxBitrateKbps: number };
  audioStreamIndex?: number;
  subtitles: { kind: 'none' } | { kind: 'burnIn'; streamIndex: number; isImageBased: boolean };
};

type PlanToSessionSpecOptions = {
  plan: PlaybackPlan;
  inputPath: string;
  sourceRange: string;
  imageSubtitleIndexes?: number[];
  capabilities: Capabilities;
  startSeconds: number;
  segmentSeconds: number;
  /**
   * The audio stream a viewer asked for, when they asked for one.
   *
   * Left out means whichever the container marks as default, which is what
   * someone who has expressed no preference should get.
   */
  audioStreamIndex?: number;
};

type SpecOutcome =
  { kind: 'ok'; spec: SessionSpec; warnings: string[] } | { kind: 'unsupported'; reason: string };

const HDR_RANGES = new Set(['HDR10', 'HDR10Plus', 'HLG', 'DolbyVision']);

/**
 * Decides whether this transcode has to convert HDR to SDR, and whether the
 * server can actually do it.
 *
 * A build with no tone mapping filter still produces a picture, but a washed
 * out one. Saying so is the difference between a viewer knowing their server
 * needs a better ffmpeg and thinking the film itself is broken. See ADR-0010.
 */
const planToneMapping = (
  sourceRange: string,
  targetRange: string,
  capability: ToneMapping,
): { toneMap?: ToneMapping; warnings: string[] } => {
  const converting = HDR_RANGES.has(sourceRange) && !HDR_RANGES.has(targetRange);

  if (!converting) {
    return { warnings: [] };
  }

  if (capability === 'unavailable') {
    return {
      warnings: [
        'This server cannot tone map HDR to SDR, so colours in this stream will look washed out. Its FFmpeg build is missing the zscale or libplacebo filter.',
      ],
    };
  }

  return { toneMap: capability, warnings: [] };
};

/**
 * The audio encoder Flux transcodes to.
 *
 * FFmpeg's native AAC encoder is always present in any build worth shipping,
 * so audio never needs the capability negotiation that video does.
 */
const AUDIO_ENCODER = 'aac';

/**
 * Picks the encoder for a codec, preferring hardware.
 *
 * Only encoders the media service actually ran a frame through are listed, so
 * anything chosen here is known to work on this machine rather than merely
 * compiled in. See ADR-0009.
 */
const selectEncoder = (capabilities: Capabilities, codec: string): VerifiedEncoder | null =>
  capabilities.encoders.find((encoder) => encoder.codec === codec && encoder.accel !== 'none') ??
  capabilities.encoders.find((encoder) => encoder.codec === codec) ??
  null;

/**
 * Turns a negotiated plan into an instruction the media service can run.
 *
 * This is the join between the two halves of playback: the negotiator decides
 * *what* has to change, this decides *how* the machine will do it. Keeping
 * them apart means the decision can be explained without knowing what hardware
 * is present, and the hardware choice can change without touching negotiation.
 *
 * Subtitle burn-in forces a video encode even when the video itself is
 * acceptable, because burning in means drawing on the frames.
 */
const planToSessionSpec = ({
  plan,
  inputPath,
  sourceRange,
  capabilities,
  startSeconds,
  segmentSeconds,
  audioStreamIndex,
  imageSubtitleIndexes = [],
}: PlanToSessionSpecOptions): SpecOutcome => {
  const isImageBased =
    plan.subtitles.kind === 'burnIn' && imageSubtitleIndexes.includes(plan.subtitles.streamIndex);

  const canBurn = isImageBased
    ? capabilities.canBurnImageSubtitles !== false
    : capabilities.canBurnTextSubtitles !== false;

  const subtitleWarnings =
    plan.subtitles.kind === 'burnIn' && !canBurn
      ? [
          `This server cannot burn in ${isImageBased ? 'image' : 'text'} subtitles, so they will not appear. Its FFmpeg build is missing the ${isImageBased ? 'overlay' : 'subtitles'} filter.`,
        ]
      : [];

  const mustBurnIn = plan.subtitles.kind === 'burnIn' && canBurn;

  const subtitles: SessionSpec['subtitles'] =
    plan.subtitles.kind === 'burnIn' && canBurn
      ? {
          kind: 'burnIn',
          streamIndex: plan.subtitles.streamIndex,
          isImageBased,
        }
      : { kind: 'none' };
  const needsVideoEncode = plan.video.kind === 'transcode' || mustBurnIn;

  if (!needsVideoEncode) {
    return {
      kind: 'ok',
      warnings: subtitleWarnings,
      spec: {
        inputPath,
        startSeconds,
        segmentSeconds,
        hardwareAccel: 'none',
        subtitles,
        ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
        video: { kind: 'copy' },
        audio:
          plan.audio.kind === 'transcode'
            ? {
                kind: 'encode',
                encoder: AUDIO_ENCODER,
                channels: plan.audio.channels,
                maxBitrateKbps: plan.audio.maxBitrateKbps,
              }
            : { kind: 'copy' },
      },
    };
  }

  const targetCodec = plan.video.kind === 'transcode' ? plan.video.codec : 'h264';
  const chosen = selectEncoder(capabilities, targetCodec) ?? selectEncoder(capabilities, 'h264');

  if (chosen === null) {
    return {
      kind: 'unsupported',
      reason: `This server has no working encoder for ${targetCodec}.`,
    };
  }

  const limits =
    plan.video.kind === 'transcode'
      ? {
          maxBitrateKbps: plan.video.maxBitrateKbps,
          maxWidth: plan.video.maxWidth,
          maxHeight: plan.video.maxHeight,
        }
      : { maxBitrateKbps: 8000, maxWidth: 1920, maxHeight: 1080 };

  const targetRange = plan.video.kind === 'transcode' ? plan.video.range : sourceRange;
  const mapping = planToneMapping(
    sourceRange,
    targetRange,
    capabilities.toneMapping ?? 'unavailable',
  );

  return {
    kind: 'ok',
    warnings: [...mapping.warnings, ...subtitleWarnings],
    spec: {
      inputPath,
      startSeconds,
      segmentSeconds,
      hardwareAccel: chosen.accel,
      subtitles,
      ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
      video: {
        kind: 'encode',
        encoder: chosen.encoder,
        ...limits,
        ...(mapping.toneMap === undefined ? {} : { toneMap: mapping.toneMap }),
      },
      audio:
        plan.audio.kind === 'transcode'
          ? {
              kind: 'encode',
              encoder: AUDIO_ENCODER,
              channels: plan.audio.channels,
              maxBitrateKbps: plan.audio.maxBitrateKbps,
            }
          : { kind: 'copy' },
    },
  };
};

export type { Capabilities, SessionSpec, SpecOutcome, ToneMapping, VerifiedEncoder };

export { planToSessionSpec, selectEncoder, planToneMapping, AUDIO_ENCODER };
