import { z } from 'zod';

const SideDataSchema = z.object({
  side_data_type: z.string().optional(),
  rotation: z.number().optional(),
});

const StreamSchema = z.object({
  codec_type: z.string().optional(),
  side_data_list: z.array(SideDataSchema).optional(),
  codec_name: z.string().optional(),
  pix_fmt: z.string().optional(),
  field_order: z.string().optional(),
  color_transfer: z.string().optional(),
  channels: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  level: z.number().optional(),
  r_frame_rate: z.string().optional(),
  sample_aspect_ratio: z.string().optional(),
  sample_rate: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const FrameSchema = z.object({
  side_data_list: z.array(SideDataSchema).optional(),
});

const FormatSchema = z.object({
  start_time: z.string().optional(),
});

const ProbeSchema = z.object({
  streams: z.array(StreamSchema).default([]),
  frames: z.array(FrameSchema).default([]),
  format: FormatSchema.default({}),
});

type FixtureFacts = {
  videoCodec: string;
  hasMasteringDisplay: boolean;
  bitDepth: number;
  range: 'SDR' | 'HDR10' | 'HLG';
  scan: 'progressive' | 'interlaced';
  audioCodec: string;
  audioChannels: number;
  audioSampleRate: number;
  audioTrackCount: number;
  width: number;
  height: number;
  frameRate: number;
  level: number;
  pixelAspect: string;
  rotationDegrees: number;
  startSeconds: number;
};

const TRANSFER_RANGES: Record<string, FixtureFacts['range']> = {
  smpte2084: 'HDR10',
  'arib-std-b67': 'HLG',
};

/**
 * What a file actually turned out to be, as ffprobe sees it.
 *
 * The corpus is only worth having if each fixture is what it claims, and "claims" is a string in a
 * matrix while "is" is a property of the bytes. Reading the second and comparing it to the first is
 * what stops the corpus inheriting the fault it exists to cure.
 *
 * HDR10's mastering display and content light level travel as SEI messages inside the bitstream
 * rather than as stream properties, so they only appear once a frame has been read. That is why the
 * probe this reads asks for the first frame as well as the streams.
 *
 * @param json - The output of `ffprobe -show_streams -show_frames -of json`.
 * @returns The properties the corpus varies, as measured.
 */
const fixtureFacts = (json: string): FixtureFacts => {
  const probe = ProbeSchema.parse(JSON.parse(json));

  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
  const audio = audioStreams[0];

  const [numerator = '0', denominator = '1'] = (video?.r_frame_rate ?? '0/1').split('/');
  const rotationSide = (video?.side_data_list ?? []).find(
    (entry) => entry.rotation !== undefined,
  )?.rotation;
  const tags = video?.tags ?? {};
  const rotationKey = Object.keys(tags).find((key) => key.toLowerCase() === 'rotate');
  const rotationTag = Number(rotationKey === undefined ? '0' : (tags[rotationKey] ?? '0'));

  const pixelFormat = video?.pix_fmt ?? '';
  const fieldOrder = video?.field_order ?? 'progressive';

  const sideData = [
    ...(video?.side_data_list ?? []),
    ...probe.frames.flatMap((frame) => frame.side_data_list ?? []),
  ].map((entry) => entry.side_data_type ?? '');

  return {
    videoCodec: video?.codec_name ?? '',
    hasMasteringDisplay: sideData.includes('Mastering display metadata'),
    bitDepth: pixelFormat.includes('10') ? 10 : 8,
    range: TRANSFER_RANGES[video?.color_transfer ?? ''] ?? 'SDR',
    scan: fieldOrder === 'progressive' || fieldOrder === '' ? 'progressive' : 'interlaced',
    audioCodec: audio?.codec_name ?? '',
    audioChannels: audio?.channels ?? 0,
    audioSampleRate: Number(audio?.sample_rate ?? '0'),
    audioTrackCount: audioStreams.length,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    frameRate: Math.round(Number(numerator) / Math.max(1, Number(denominator))),
    level: video?.level ?? 0,
    pixelAspect: (video?.sample_aspect_ratio ?? '1:1').replace(':', '/'),
    rotationDegrees: Math.abs(rotationSide ?? rotationTag),
    startSeconds: Math.round(Number(probe.format.start_time ?? '0')),
  };
};

export type { FixtureFacts };

export { fixtureFacts };
