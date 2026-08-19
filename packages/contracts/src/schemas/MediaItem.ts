import { z } from 'zod';

const VideoRangeSchema = z.enum(['SDR', 'HDR10', 'HDR10Plus', 'HLG', 'DolbyVision']);

const KNOWN_VIDEO_CODECS = [
  'h264',
  'hevc',
  'av1',
  'vp9',
  'vp8',
  'mpeg2',
  'vc1',
  'mpeg4',
  'mpeg1video',
] as const;

const KNOWN_AUDIO_CODECS = [
  'aac',
  'mp3',
  'mp2',
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
] as const;

const KNOWN_CONTAINERS = ['mp4', 'mkv', 'webm', 'ts', 'm2ts', 'mov', 'avi', 'unknown'] as const;

const VideoCodecSchema = z
  .string()
  .min(1)
  .describe(
    'What the demuxer calls this encoding. Any name is accepted, because a library holds whatever it holds and a codec nobody listed is still a file somebody wants to watch. A name no client claims simply never direct-plays.',
  );

const AudioCodecSchema = z
  .string()
  .min(1)
  .describe('What the demuxer calls this encoding. Open for the same reason as the video codec.');

const ContainerSchema = z
  .string()
  .min(1)
  .describe(
    'What the demuxer calls this format, or `unknown` where Flux has no name for it. Open for the same reason as the video codec.',
  );

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
  sampleRate: z.number().int().positive().nullish(),
  profile: z.string().nullish(),
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

const MediaItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  year: z.number().int().min(1870).max(2200).nullish(),
  container: ContainerSchema,
  durationSeconds: z.number().positive(),
  videoCodec: VideoCodecSchema,
  videoRange: VideoRangeSchema,
  videoRangeBase: VideoRangeSchema.nullish().describe(
    'What a player that cannot read this file\u2019s dynamic metadata sees underneath it. The same as the range itself for anything with nothing extra to ignore. Dolby Vision profile 8.1 declares an HDR10 base and HDR10+ is HDR10 with per-scene metadata added, so an HDR10 screen shows either correctly on its own \u2014 which is why a server that reads this sends the file untouched where one that does not re-encodes it. Absent where a file predates knowing, which is read as nothing but its own range.',
  ),
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
  videoLevel: z
    .number()
    .int()
    .positive()
    .nullish()
    .describe(
      'The codec level as the codec numbers it. H.264 calls level 5.1 fifty-one and HEVC calls level 2.1 sixty-three, so it is only comparable against a limit for the same codec.',
    ),
  videoFrameRate: z.number().positive().nullish(),
  videoIsInterlaced: z.boolean().default(false),
  videoRefFrames: z
    .number()
    .int()
    .positive()
    .nullish()
    .describe(
      'How many frames the decoder must keep. Only meaningful for H.264: ffprobe reports a flat 1 for HEVC whatever the stream holds, so a ceiling never refuses an HEVC source.',
    ),
  videoPixelAspect: z
    .string()
    .nullish()
    .describe('The pixel shape where it is not square, as a ratio like 4/3. Absent means square.'),
  videoRotationDegrees: z.number().int().nullish(),
  audioStreams: z.array(AudioStreamSchema).min(1),
  subtitleStreams: z.array(SubtitleStreamSchema),
});

export type VideoRange = z.infer<typeof VideoRangeSchema>;
export type VideoCodec = (typeof KNOWN_VIDEO_CODECS)[number] | (string & {});
export type AudioCodec = (typeof KNOWN_AUDIO_CODECS)[number] | (string & {});
export type Container = (typeof KNOWN_CONTAINERS)[number] | (string & {});
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>;
export type AudioStream = z.infer<typeof AudioStreamSchema>;
export type SubtitleStream = z.infer<typeof SubtitleStreamSchema>;
export type MediaItem = z.infer<typeof MediaItemSchema>;

export {
  KNOWN_AUDIO_CODECS,
  KNOWN_CONTAINERS,
  KNOWN_VIDEO_CODECS,
  MediaItemSchema,
  VideoRangeSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  ContainerSchema,
  SubtitleFormatSchema,
  AudioStreamSchema,
  SubtitleStreamSchema,
};
