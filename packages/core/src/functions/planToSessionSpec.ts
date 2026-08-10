import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan'

type VerifiedEncoder = {
  codec: string
  encoder: string
  accel: string
}

type Capabilities = {
  encoders: VerifiedEncoder[]
}

type SessionSpec = {
  inputPath: string
  startSeconds: number
  segmentSeconds: number
  hardwareAccel: string
  video:
    | { kind: 'copy' }
    | {
        kind: 'encode'
        encoder: string
        maxBitrateKbps: number
        maxWidth: number
        maxHeight: number
      }
  audio:
    { kind: 'copy' } | { kind: 'encode'; encoder: string; channels: number; maxBitrateKbps: number }
}

type PlanToSessionSpecOptions = {
  plan: PlaybackPlan
  inputPath: string
  capabilities: Capabilities
  startSeconds: number
  segmentSeconds: number
}

type SpecOutcome = { kind: 'ok'; spec: SessionSpec } | { kind: 'unsupported'; reason: string }

/**
 * The audio encoder Flux transcodes to.
 *
 * FFmpeg's native AAC encoder is always present in any build worth shipping,
 * so audio never needs the capability negotiation that video does.
 */
const AUDIO_ENCODER = 'aac'

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
  null

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
  capabilities,
  startSeconds,
  segmentSeconds,
}: PlanToSessionSpecOptions): SpecOutcome => {
  const mustBurnIn = plan.subtitles.kind === 'burnIn'
  const needsVideoEncode = plan.video.kind === 'transcode' || mustBurnIn

  if (!needsVideoEncode) {
    return {
      kind: 'ok',
      spec: {
        inputPath,
        startSeconds,
        segmentSeconds,
        hardwareAccel: 'none',
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
    }
  }

  const targetCodec = plan.video.kind === 'transcode' ? plan.video.codec : 'h264'
  const chosen = selectEncoder(capabilities, targetCodec) ?? selectEncoder(capabilities, 'h264')

  if (chosen === null) {
    return {
      kind: 'unsupported',
      reason: `This server has no working encoder for ${targetCodec}.`,
    }
  }

  const limits =
    plan.video.kind === 'transcode'
      ? {
          maxBitrateKbps: plan.video.maxBitrateKbps,
          maxWidth: plan.video.maxWidth,
          maxHeight: plan.video.maxHeight,
        }
      : { maxBitrateKbps: 8000, maxWidth: 1920, maxHeight: 1080 }

  return {
    kind: 'ok',
    spec: {
      inputPath,
      startSeconds,
      segmentSeconds,
      hardwareAccel: chosen.accel,
      video: { kind: 'encode', encoder: chosen.encoder, ...limits },
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
  }
}

export type { Capabilities, SessionSpec, SpecOutcome, VerifiedEncoder }

export default { planToSessionSpec, selectEncoder, AUDIO_ENCODER }
