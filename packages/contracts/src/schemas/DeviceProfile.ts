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

/**
 * A client's declared playback capabilities. Clients may submit their own
 * profile rather than being identified by user agent, which is guesswork.
 *
 * Depth is asked separately from codec because they are separate questions,
 * and answering the first for the second is what sent a ten bit film to a
 * browser that could only decode eight: it played for twenty seconds and then
 * stopped, with a full buffer, a frozen picture and no error anywhere.
 *
 * See ADR-0011.
 */
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
  supportedSubtitleFormats: z.array(SubtitleFormatSchema),
  directPlayProfiles: z.array(DirectPlayProfileSchema).min(1),
  transcodingProfiles: z.array(TranscodingProfileSchema).min(1),
});

export type DirectPlayProfile = z.infer<typeof DirectPlayProfileSchema>;
export type TranscodingProfile = z.infer<typeof TranscodingProfileSchema>;
export type DeviceProfile = z.infer<typeof DeviceProfileSchema>;

export { DeviceProfileSchema, DirectPlayProfileSchema, TranscodingProfileSchema };
