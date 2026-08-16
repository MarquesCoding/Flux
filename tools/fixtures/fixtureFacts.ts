import { z } from 'zod';

const StreamSchema = z.object({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  pix_fmt: z.string().optional(),
  field_order: z.string().optional(),
  color_transfer: z.string().optional(),
  channels: z.number().optional(),
});

const ProbeSchema = z.object({
  streams: z.array(StreamSchema).default([]),
});

type FixtureFacts = {
  videoCodec: string;
  bitDepth: number;
  range: 'SDR' | 'HDR10' | 'HLG';
  scan: 'progressive' | 'interlaced';
  audioCodec: string;
  audioChannels: number;
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
 * @param json - The output of `ffprobe -show_streams -of json`.
 * @returns The properties the corpus varies, as measured.
 */
const fixtureFacts = (json: string): FixtureFacts => {
  const probe = ProbeSchema.parse(JSON.parse(json));

  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');

  const pixelFormat = video?.pix_fmt ?? '';
  const fieldOrder = video?.field_order ?? 'progressive';

  return {
    videoCodec: video?.codec_name ?? '',
    bitDepth: pixelFormat.includes('10') ? 10 : 8,
    range: TRANSFER_RANGES[video?.color_transfer ?? ''] ?? 'SDR',
    scan: fieldOrder === 'progressive' || fieldOrder === '' ? 'progressive' : 'interlaced',
    audioCodec: audio?.codec_name ?? '',
    audioChannels: audio?.channels ?? 0,
  };
};

export type { FixtureFacts };

export { fixtureFacts };
