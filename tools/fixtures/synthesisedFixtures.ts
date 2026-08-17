import type { FixtureTier } from './fixtureMatrix';

type HdrSystem = 'DolbyVision' | 'HDR10Plus';

type SynthesisedFixture = {
  name: string;
  tier: FixtureTier;
  file: string;
  system: HdrSystem;
  frames: number;
  licence: string;
  covers: string;
};

const FRAME_RATE = 25;

const SYNTHESISED: readonly SynthesisedFixture[] = [
  {
    name: 'dolby-vision-profile-81',
    tier: 2,
    file: 'dolby-vision-profile-81.mkv',
    system: 'DolbyVision',
    frames: 240,
    licence: 'Generated; the metadata is written rather than taken from anywhere',
    covers:
      'Dolby Vision profile 8.1, whose base layer is HDR10 so a player without the RPU still shows a picture',
  },
  {
    name: 'hdr10plus-dynamic',
    tier: 2,
    file: 'hdr10plus-dynamic.mkv',
    system: 'HDR10Plus',
    frames: 240,
    licence: 'Generated; the metadata is written rather than taken from anywhere',
    covers: 'HDR10+ dynamic metadata, which rides on frames and which no other fixture carries',
  },
];

const TOOLS = {
  dovi: { version: '2.3.3', repo: 'quietvoid/dovi_tool', binary: 'dovi_tool' },
  hdr10plus: { version: '1.7.2', repo: 'quietvoid/hdr10plus_tool', binary: 'hdr10plus_tool' },
} as const;

/**
 * Where a metadata tool is downloaded from for this machine.
 *
 * Both are MIT and publish prebuilt binaries, so the corpus does not need a Rust toolchain to
 * build the one thing FFmpeg cannot author for itself.
 *
 * @param tool - Which tool.
 * @param platform - The value of `process.platform`.
 * @param arch - The value of `process.arch`.
 * @returns The release asset URL, or nothing where this machine has no build.
 */
const toolUrl = (
  tool: keyof typeof TOOLS,
  platform: string,
  arch: string,
): { url: string; archive: 'zip' | 'tar' } | null => {
  const { version, repo, binary } = TOOLS[tool];
  const base = `https://github.com/${repo}/releases/download/${version}`;

  if (platform === 'darwin') {
    return { url: `${base}/${binary}-${version}-universal-macOS.zip`, archive: 'zip' };
  }

  if (platform === 'linux') {
    const target = arch === 'arm64' ? 'aarch64' : 'x86_64';

    return {
      url: `${base}/${binary}-${version}-${target}-unknown-linux-musl.tar.gz`,
      archive: 'tar',
    };
  }

  return null;
};

/**
 * The HEVC the metadata is written onto.
 *
 * HDR10 to begin with, because both systems are layered over it: Dolby Vision profile 8.1 declares
 * an HDR10 base layer, and HDR10+ adds dynamic metadata to a stream that is already HDR10. Written
 * as a raw stream rather than a container, since that is what the injectors read.
 *
 * @param fixture - The fixture being synthesised.
 * @param outputPath - Where to write the base stream.
 * @returns The arguments to pass to FFmpeg, without the binary itself.
 */
const baseStreamArguments = (fixture: SynthesisedFixture, outputPath: string): string[] => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-f',
  'lavfi',
  '-i',
  `testsrc2=size=640x360:rate=${FRAME_RATE.toString()}`,
  '-t',
  (fixture.frames / FRAME_RATE).toString(),
  '-c:v',
  'libx265',
  '-pix_fmt',
  'yuv420p10le',
  '-x265-params',
  [
    'keyint=50',
    'min-keyint=50',
    'scenecut=0',
    'open-gop=0',
    'colorprim=bt2020',
    'transfer=smpte2084',
    'colormatrix=bt2020nc',
    'master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1)',
    'max-cll=1000,400',
    'hdr10=1',
    'log-level=error',
    'pools=1',
    'frame-threads=1',
  ].join(':'),
  '-f',
  'hevc',
  outputPath,
];

/**
 * How the finished stream is put into a container.
 *
 * `mkvmerge` rather than FFmpeg, and this is the whole reason the tool is needed. A Dolby Vision
 * RPU travels in `unspec62` NAL units: FFmpeg's MP4 muxer drops them and its Matroska muxer refuses
 * the packets outright, so a stream muxed by FFmpeg arrives with the metadata gone. Matroska
 * written by mkvmerge carries them, which is why every Dolby Vision file in the wild is one.
 *
 * @param sourcePath - The injected raw stream.
 * @param outputPath - Where to write the fixture.
 * @returns The arguments to pass to mkvmerge, without the binary itself.
 */
const muxArguments = (sourcePath: string, outputPath: string): string[] => [
  '-o',
  outputPath,
  '--default-duration',
  `0:${FRAME_RATE.toString()}fps`,
  sourcePath,
];

/**
 * Every synthesised fixture at or below a tier.
 *
 * Tier two, because they need three tools beyond FFmpeg and are the least likely thing a
 * contributor wants on a first run — not because they are expensive. They take seconds.
 *
 * @param tier - The highest tier to include.
 * @returns The fixtures to synthesise, in a stable order.
 */
const synthesisedUpTo = (tier: FixtureTier): readonly SynthesisedFixture[] =>
  SYNTHESISED.filter((fixture) => fixture.tier <= tier);

export type { HdrSystem, SynthesisedFixture };

export { baseStreamArguments, muxArguments, SYNTHESISED, synthesisedUpTo, toolUrl, TOOLS };
