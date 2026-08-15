import { z } from 'zod';
import {
  ContainerSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  SubtitleFormatSchema,
  VideoRangeSchema,
} from './MediaItem';

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
]);

const ReasonSchema = z.object({
  code: ReasonCodeSchema,
  detail: z.string().min(1),
});

const ContainerDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('passthrough'), reason: ReasonSchema }),
  z.object({ kind: z.literal('remux'), target: ContainerSchema, reason: ReasonSchema }),
]);

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
]);

const AudioDecisionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('passthrough'),
    streamIndex: z.number().int().nullable(),
    reason: ReasonSchema,
  }),
  z.object({
    kind: z.literal('transcode'),
    streamIndex: z.number().int().nullable(),
    codec: AudioCodecSchema,
    channels: z.number().int().positive(),
    maxBitrateKbps: z.number().int().positive(),
    reason: ReasonSchema,
  }),
]);

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
]);

const PlaybackPlanSchema = z.object({
  mediaId: z.string().uuid(),
  container: ContainerDecisionSchema,
  video: VideoDecisionSchema,
  audio: AudioDecisionSchema,
  subtitles: SubtitleDecisionSchema,
});

export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type Reason = z.infer<typeof ReasonSchema>;
export type ContainerDecision = z.infer<typeof ContainerDecisionSchema>;
export type VideoDecision = z.infer<typeof VideoDecisionSchema>;
export type AudioDecision = z.infer<typeof AudioDecisionSchema>;
export type SubtitleDecision = z.infer<typeof SubtitleDecisionSchema>;
export type PlaybackPlan = z.infer<typeof PlaybackPlanSchema>;

export {
  PlaybackPlanSchema,
  ReasonCodeSchema,
  ReasonSchema,
  ContainerDecisionSchema,
  VideoDecisionSchema,
  AudioDecisionSchema,
  SubtitleDecisionSchema,
};
