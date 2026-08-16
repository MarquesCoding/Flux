import type { FixtureTier } from './fixtureMatrix';

type DerivedFixture = {
  name: string;
  tier: FixtureTier;
  file: string;
  from: string;
  subtitleEncoder: string;
  licence: string;
  covers: string;
};

const DERIVED: readonly DerivedFixture[] = [
  {
    name: 'vobsub-subtitles',
    tier: 1,
    file: 'vobsub-subtitles.mkv',
    from: 'pgs-subtitles.mkv',
    subtitleEncoder: 'dvdsub',
    licence: 'Derived from a fetched fixture; never redistributed',
    covers: 'DVD bitmap subtitles, which Flux must burn in rather than convert',
  },
  {
    name: 'dvbsub-subtitles',
    tier: 1,
    file: 'dvbsub-subtitles.mkv',
    from: 'pgs-subtitles.mkv',
    subtitleEncoder: 'dvbsub',
    licence: 'Derived from a fetched fixture; never redistributed',
    covers: 'Broadcast bitmap subtitles, the third image format the schema claims',
  },
];

/**
 * The arguments that turn one fixture into another.
 *
 * FFmpeg will convert a subtitle stream between two bitmap formats but will not rasterise text into
 * one: asking it to encode SubRip as `dvdsub` fails outright. So the bitmap formats it can encode —
 * VobSub and DVB — are reachable only from a bitmap source, and the fetched PGS sample is the only
 * one there is. Deriving them costs a few kilobytes and no further downloads.
 *
 * @param fixture - What to derive.
 * @param sourcePath - The fixture it is derived from.
 * @param outputPath - Where to write it.
 * @returns The arguments to pass to FFmpeg, without the binary itself.
 */
const derivedArguments = (
  fixture: DerivedFixture,
  sourcePath: string,
  outputPath: string,
): string[] => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-i',
  sourcePath,
  '-map',
  '0:v',
  '-map',
  '0:s',
  '-c:v',
  'copy',
  '-c:s',
  fixture.subtitleEncoder,
  outputPath,
];

/**
 * Every derived fixture at or below a tier.
 *
 * @param tier - The highest tier to include.
 * @returns The fixtures to derive, in a stable order.
 */
const derivedUpTo = (tier: FixtureTier): readonly DerivedFixture[] =>
  DERIVED.filter((fixture) => fixture.tier <= tier);

export type { DerivedFixture };

export { DERIVED, derivedArguments, derivedUpTo };
