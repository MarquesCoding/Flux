import { z } from 'zod';

const VideoRangeSchema = z.enum(['SDR', 'HDR10', 'HDR10Plus', 'HLG', 'DolbyVision']);

const VideoCodecSchema = z.enum(['h264', 'hevc', 'av1', 'vp9', 'vp8', 'mpeg2', 'vc1']);

const AudioCodecSchema = z.enum([
  'aac',
  'mp3',
  'flac',
  'alac',
  'opus',
  'vorbis',
  'ac3',
  'eac3',
  'truehd',
  'dts',
  'dtshd',
  'pcm',
]);

const ContainerSchema = z.enum(['mp4', 'mkv', 'webm', 'ts', 'm2ts', 'mov', 'avi']);

/**
 * The subtitle formats Flux understands, and the admission that a file may
 * carry one it does not.
 *
 * `unknown` is what the transcoder reports for a codec it has no mapping for,
 * and leaving it out of this list did not stop such files existing: it stopped
 * them being read at all, because the whole item failed to parse on the way to
 * the client.
 */
const SubtitleFormatSchema = z.enum([
  'srt',
  'webvtt',
  'ass',
  'ssa',
  'vobsub',
  'pgs',
  'dvbsub',
  'unknown',
]);

const AudioStreamSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: AudioCodecSchema,
  channels: z.number().int().positive(),
  language: z.string().nullish(),
  title: z.string().nullish(),
  isDefault: z.boolean().default(false),
  isAtmos: z.boolean(),
});

const SubtitleStreamSchema = z.object({
  index: z.number().int().nonnegative(),
  format: SubtitleFormatSchema,
  language: z.string().nullish(),
  title: z.string().nullish(),
  isForced: z.boolean(),
});

/**
 * A single playable media file with the stream details the playback negotiator
 * needs. Every field here is derived from probing the file, never from the
 * filename or from user input.
 */
const MediaItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  year: z.number().int().min(1870).max(2200).nullish(),
  container: ContainerSchema,
  durationSeconds: z.number().positive(),
  videoCodec: VideoCodecSchema,
  videoRange: VideoRangeSchema,
  videoBitDepth: z
    .number()
    .int()
    .positive()
    .default(8)
    .describe(
      'How many bits each colour sample carries. Eight where a file predates knowing. A client that plays a codec at eight bits may refuse it at ten, so this decides whether the source can be copied.',
    ),
  canCopySegments: z
    .boolean()
    .default(true)
    .describe(
      'Whether this source can be delivered by copying it. False when its own keyframes cannot yield segments a player will take, either because a decoder cannot start at them or because avoiding those makes the segments far too long. True where a file predates knowing, which is what Flux assumed anyway.',
    ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bitrateKbps: z.number().int().positive(),
  audioStreams: z.array(AudioStreamSchema).min(1),
  subtitleStreams: z.array(SubtitleStreamSchema),
});

export type VideoRange = z.infer<typeof VideoRangeSchema>;
export type VideoCodec = z.infer<typeof VideoCodecSchema>;
export type AudioCodec = z.infer<typeof AudioCodecSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>;
export type AudioStream = z.infer<typeof AudioStreamSchema>;
export type SubtitleStream = z.infer<typeof SubtitleStreamSchema>;
export type MediaItem = z.infer<typeof MediaItemSchema>;

export {
  MediaItemSchema,
  VideoRangeSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  ContainerSchema,
  SubtitleFormatSchema,
  AudioStreamSchema,
  SubtitleStreamSchema,
};
