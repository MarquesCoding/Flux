import { z } from 'zod'

const VideoRangeSchema = z.enum(['SDR', 'HDR10', 'HDR10Plus', 'HLG', 'DolbyVision'])

const VideoCodecSchema = z.enum(['h264', 'hevc', 'av1', 'vp9', 'vp8', 'mpeg2', 'vc1'])

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
])

const ContainerSchema = z.enum(['mp4', 'mkv', 'webm', 'ts', 'm2ts', 'mov', 'avi'])

const SubtitleFormatSchema = z.enum(['srt', 'webvtt', 'ass', 'ssa', 'vobsub', 'pgs', 'dvbsub'])

const AudioStreamSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: AudioCodecSchema,
  channels: z.number().int().positive(),
  /**
   * Whatever the file called the language.
   *
   * Deliberately unconstrained. Files carry two-letter codes, three-letter
   * codes, both competing three-letter standards, the language written out,
   * and `und`. Demanding one shape rejects real media over a label.
   */
  language: z.string().nullish(),
  /**
   * What the file calls this track, when it says.
   *
   * Often the only thing telling two tracks of one language apart.
   */
  title: z.string().nullish(),
  isDefault: z.boolean().default(false),
  isAtmos: z.boolean(),
})

const SubtitleStreamSchema = z.object({
  index: z.number().int().nonnegative(),
  format: SubtitleFormatSchema,
  /**
   * Unconstrained for the same reason audio languages are: a real file labels
   * its tracks however whoever made it felt like.
   */
  language: z.string().nullish(),
  isForced: z.boolean(),
})

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
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bitrateKbps: z.number().int().positive(),
  audioStreams: z.array(AudioStreamSchema).min(1),
  subtitleStreams: z.array(SubtitleStreamSchema),
})

export type VideoRange = z.infer<typeof VideoRangeSchema>
export type VideoCodec = z.infer<typeof VideoCodecSchema>
export type AudioCodec = z.infer<typeof AudioCodecSchema>
export type Container = z.infer<typeof ContainerSchema>
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>
export type AudioStream = z.infer<typeof AudioStreamSchema>
export type SubtitleStream = z.infer<typeof SubtitleStreamSchema>
export type MediaItem = z.infer<typeof MediaItemSchema>

export default {
  MediaItemSchema,
  VideoRangeSchema,
  VideoCodecSchema,
  AudioCodecSchema,
  ContainerSchema,
  SubtitleFormatSchema,
  AudioStreamSchema,
  SubtitleStreamSchema,
}
