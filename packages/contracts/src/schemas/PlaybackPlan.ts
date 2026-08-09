import { z } from 'zod'
import MediaItemModule from './MediaItem'

const {
  ContainerSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  SubtitleFormatSchema,
  VideoRangeSchema,
} = MediaItemModule

const ReasonCodeSchema = z.enum([
  'ClientSupportsSource',
  'ContainerNotSupported',
  'VideoCodecNotSupported',
  'VideoProfileNotSupported',
  'VideoBitrateAboveLimit',
  'VideoResolutionAboveLimit',
  'VideoRangeNotSupported',
  'AudioCodecNotSupported',
  'AudioChannelsAboveLimit',
  'AudioBitrateAboveLimit',
  'SubtitleFormatNotSupported',
  'SubtitleNotCarryableInContainer',
  'UserForcedTranscode',
])

const ReasonSchema = z.object({
  code: ReasonCodeSchema,
  detail: z.string().min(1),
})

const ContainerDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('passthrough'), reason: ReasonSchema }),
  z.object({ kind: z.literal('remux'), target: ContainerSchema, reason: ReasonSchema }),
])

const VideoDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('passthrough'), reason: ReasonSchema }),
  z.object({
    kind: z.literal('transcode'),
    codec: VideoCodecSchema,
    range: VideoRangeSchema,
    maxBitrateKbps: z.number().int().positive(),
    maxWidth: z.number().int().positive(),
    maxHeight: z.number().int().positive(),
    reason: ReasonSchema,
  }),
])

const AudioDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('passthrough'), reason: ReasonSchema }),
  z.object({
    kind: z.literal('transcode'),
    codec: AudioCodecSchema,
    channels: z.number().int().positive(),
    maxBitrateKbps: z.number().int().positive(),
    reason: ReasonSchema,
  }),
])

const SubtitleDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), reason: ReasonSchema }),
  z.object({ kind: z.literal('passthrough'), streamIndex: z.number().int(), reason: ReasonSchema }),
  z.object({
    kind: z.literal('sidecar'),
    streamIndex: z.number().int(),
    format: SubtitleFormatSchema,
    reason: ReasonSchema,
  }),
  z.object({ kind: z.literal('burnIn'), streamIndex: z.number().int(), reason: ReasonSchema }),
])

/**
 * The output of playback negotiation. Each axis is decided independently so
 * that a mismatch on one can never force a re-encode on another, and every
 * axis carries a mandatory reason so the decision is always explainable.
 *
 * See ADR-0011.
 */
const PlaybackPlanSchema = z.object({
  mediaId: z.string().uuid(),
  container: ContainerDecisionSchema,
  video: VideoDecisionSchema,
  audio: AudioDecisionSchema,
  subtitles: SubtitleDecisionSchema,
})

export type ReasonCode = z.infer<typeof ReasonCodeSchema>
export type Reason = z.infer<typeof ReasonSchema>
export type ContainerDecision = z.infer<typeof ContainerDecisionSchema>
export type VideoDecision = z.infer<typeof VideoDecisionSchema>
export type AudioDecision = z.infer<typeof AudioDecisionSchema>
export type SubtitleDecision = z.infer<typeof SubtitleDecisionSchema>
export type PlaybackPlan = z.infer<typeof PlaybackPlanSchema>

export default {
  PlaybackPlanSchema,
  ReasonCodeSchema,
  ReasonSchema,
  ContainerDecisionSchema,
  VideoDecisionSchema,
  AudioDecisionSchema,
  SubtitleDecisionSchema,
}
