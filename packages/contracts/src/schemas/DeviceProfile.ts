import { z } from 'zod';
import {
  ContainerSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  SubtitleFormatSchema,
  VideoRangeSchema,
} from './MediaItem';

const DirectPlayProfileSchema = z.object({
  container: ContainerSchema,
  videoCodecs: z.array(VideoCodecSchema).min(1),
  audioCodecs: z.array(AudioCodecSchema).min(1),
});

const TranscodingProfileSchema = z.object({
  container: ContainerSchema,
  videoCodec: VideoCodecSchema,
  audioCodec: AudioCodecSchema,
  protocol: z.enum(['hls', 'dash', 'http']),
});

const DeviceProfileSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  maxWidth: z.number().int().positive(),
  maxHeight: z.number().int().positive(),
  maxBitrateKbps: z.number().int().positive(),
  maxAudioChannels: z.number().int().positive(),
  supportedVideoRanges: z.array(VideoRangeSchema).min(1),
  tenBitVideoCodecs: z
    .array(VideoCodecSchema)
    .default([])
    .describe(
      'Which codecs this client can play at more than eight bits per sample. Empty means eight bit only.',
    ),
  maxVideoLevels: z
    .record(VideoCodecSchema, z.number().int().positive())
    .default({})
    .describe(
      'The highest codec level this client decodes, per codec, numbered as that codec numbers it. Absent for a codec means no limit is claimed.',
    ),
  maxFrameRate: z.number().positive().nullish(),
  maxRefFrames: z.number().int().positive().nullish(),
  canPlayInterlaced: z.boolean().default(true),
  canPlayAnamorphic: z.boolean().default(true),
  canRotate: z.boolean().default(true),
  maxAudioSampleRate: z.number().int().positive().nullish(),
  unsupportedAudioProfiles: z.array(z.string()).default([]),
  supportedSubtitleFormats: z.array(SubtitleFormatSchema),
  directPlayProfiles: z.array(DirectPlayProfileSchema).min(1),
  transcodingProfiles: z.array(TranscodingProfileSchema).min(1),
});

export type DirectPlayProfile = z.infer<typeof DirectPlayProfileSchema>;
export type TranscodingProfile = z.infer<typeof TranscodingProfileSchema>;
export type DeviceProfile = z.infer<typeof DeviceProfileSchema>;

export { DeviceProfileSchema, DirectPlayProfileSchema, TranscodingProfileSchema };
