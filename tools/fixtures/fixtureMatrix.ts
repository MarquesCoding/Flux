type FixtureTier = 0 | 1 | 2;

type VideoCodec = 'h264' | 'hevc' | 'av1' | 'vp9';

type GopStructure = 'open' | 'closed';

type VideoRange = 'SDR' | 'HDR10' | 'HLG';

type Scan = 'progressive' | 'interlaced';

type FrameTiming = 'constant' | 'variable';

type AudioCodec = 'aac' | 'ac3' | 'eac3' | 'truehd' | 'dts' | 'opus' | 'flac';

type Container = 'mkv' | 'mp4' | 'ts' | 'webm';

type VideoSpec = {
  codec: VideoCodec;
  bitDepth: 8 | 10;
  gop: GopStructure;
  keyframeSeconds: number;
  range: VideoRange;
  scan: Scan;
  timing: FrameTiming;
};

type AudioSpec = {
  codec: AudioCodec;
  channels: 2 | 6;
};

type Fixture = {
  name: string;
  tier: FixtureTier;
  licence: string;
  container: Container;
  durationSeconds: number;
  video: VideoSpec;
  audio: AudioSpec;
};

const GENERATED_LICENCE = 'Generated from FFmpeg synthetic sources; no licence required';

const BASELINE_VIDEO: VideoSpec = {
  codec: 'h264',
  bitDepth: 8,
  gop: 'closed',
  keyframeSeconds: 2,
  range: 'SDR',
  scan: 'progressive',
  timing: 'constant',
};

const BASELINE_AUDIO: AudioSpec = { codec: 'aac', channels: 2 };

const DEFAULT_DURATION_SECONDS = 30;

/**
 * Builds one fixture from the baseline, changing only what is named.
 *
 * The corpus is a spanning set rather than a full cross product: varying one axis at a time is what
 * makes a failure attributable. A fixture that differs from the baseline in three ways tells you
 * something broke without telling you which of the three did it, which is the position every rule
 * in the transcoder is currently in.
 *
 * @param name - What this fixture is called, which is also its filename stem.
 * @param overrides - The axes that differ from the baseline.
 * @returns The fixture definition.
 */
const varying = (
  name: string,
  overrides: {
    tier?: FixtureTier;
    container?: Container;
    durationSeconds?: number;
    video?: Partial<VideoSpec>;
    audio?: Partial<AudioSpec>;
  },
): Fixture => ({
  name,
  tier: overrides.tier ?? 0,
  licence: GENERATED_LICENCE,
  container: overrides.container ?? 'mp4',
  durationSeconds: overrides.durationSeconds ?? DEFAULT_DURATION_SECONDS,
  video: { ...BASELINE_VIDEO, ...overrides.video },
  audio: { ...BASELINE_AUDIO, ...overrides.audio },
});

const CODEC_FIXTURES: Fixture[] = [
  varying('h264-8bit-closed', {}),
  varying('hevc-8bit-closed', { video: { codec: 'hevc' } }),
  varying('hevc-10bit-closed', { video: { codec: 'hevc', bitDepth: 10 } }),
  varying('av1-8bit-closed', { video: { codec: 'av1' } }),
  varying('vp9-8bit-closed', {
    container: 'webm',
    video: { codec: 'vp9' },
    audio: { codec: 'opus' },
  }),
];

const GOP_FIXTURES: Fixture[] = [
  varying('h264-8bit-open', { video: { gop: 'open' } }),
  varying('hevc-8bit-open', { video: { codec: 'hevc', gop: 'open' } }),
  varying('hevc-10bit-open', { video: { codec: 'hevc', bitDepth: 10, gop: 'open' } }),
];

const KEYFRAME_FIXTURES: Fixture[] = [
  varying('h264-keyframes-far', { durationSeconds: 60, video: { keyframeSeconds: 10 } }),
  varying('hevc-keyframes-far', {
    durationSeconds: 60,
    video: { codec: 'hevc', keyframeSeconds: 10 },
  }),
  varying('hevc-10bit-open-keyframes-far', {
    durationSeconds: 60,
    video: { codec: 'hevc', bitDepth: 10, gop: 'open', keyframeSeconds: 10 },
  }),
];

const STRUCTURE_FIXTURES: Fixture[] = [
  varying('h264-interlaced', { video: { scan: 'interlaced' } }),
  varying('h264-variable-frame-rate', { video: { timing: 'variable' } }),
];

const RANGE_FIXTURES: Fixture[] = [
  varying('hevc-10bit-hdr10', { video: { codec: 'hevc', bitDepth: 10, range: 'HDR10' } }),
  varying('hevc-10bit-hlg', { video: { codec: 'hevc', bitDepth: 10, range: 'HLG' } }),
];

const AUDIO_FIXTURES: Fixture[] = [
  varying('audio-ac3-51', { container: 'mkv', audio: { codec: 'ac3', channels: 6 } }),
  varying('audio-eac3-51', { container: 'mkv', audio: { codec: 'eac3', channels: 6 } }),
  varying('audio-truehd-51', { container: 'mkv', audio: { codec: 'truehd', channels: 6 } }),
  varying('audio-dts-51', { container: 'mkv', audio: { codec: 'dts', channels: 6 } }),
  varying('audio-flac-stereo', { container: 'mkv', audio: { codec: 'flac' } }),
  varying('audio-opus-stereo', { container: 'mkv', audio: { codec: 'opus' } }),
  varying('audio-aac-51', { audio: { channels: 6 } }),
];

const CONTAINER_FIXTURES: Fixture[] = [
  varying('container-mkv', { container: 'mkv' }),
  varying('container-ts', { container: 'ts' }),
];

const FIXTURES: readonly Fixture[] = [
  ...CODEC_FIXTURES,
  ...GOP_FIXTURES,
  ...KEYFRAME_FIXTURES,
  ...STRUCTURE_FIXTURES,
  ...RANGE_FIXTURES,
  ...AUDIO_FIXTURES,
  ...CONTAINER_FIXTURES,
];

/**
 * Every fixture at or below a tier.
 *
 * Tier 0 costs nothing but time and runs everywhere, so it is what a contributor gets by default.
 * Asking for a higher tier includes the lower ones, because a run that tested the exotic cases and
 * skipped the ordinary ones would prove the wrong thing.
 *
 * @param tier - The highest tier to include.
 * @returns The fixtures to build, in a stable order.
 */
const fixturesUpTo = (tier: FixtureTier): readonly Fixture[] =>
  FIXTURES.filter((fixture) => fixture.tier <= tier);

/**
 * What a fixture is called on disk.
 *
 * @param fixture - The fixture.
 * @returns Its filename, stem and extension.
 */
const fixtureFileName = (fixture: Fixture): string => `${fixture.name}.${fixture.container}`;

export type {
  AudioCodec,
  AudioSpec,
  Container,
  Fixture,
  FixtureTier,
  FrameTiming,
  GopStructure,
  Scan,
  VideoCodec,
  VideoRange,
  VideoSpec,
};

export { FIXTURES, fixtureFileName, fixturesUpTo, GENERATED_LICENCE };
