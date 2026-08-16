import type { FixtureTier } from './fixtureMatrix';

type FetchedFixture = {
  name: string;
  tier: FixtureTier;
  file: string;
  url: string;
  licence: string;
  covers: string;
};

const FATE = 'https://samples.ffmpeg.org';

const FRAUNHOFER = 'https://www2.iis.fraunhofer.de/AAC';

const FETCHED: readonly FetchedFixture[] = [
  {
    name: 'pgs-subtitles',
    tier: 1,
    file: 'pgs-subtitles.mkv',
    url: `${FATE}/sub/PGS/supsample.mkv`,
    licence: 'Unknown; fetched on demand and never redistributed',
    covers: 'Bitmap subtitles, which have a decoder in FFmpeg and no encoder anywhere',
  },
  {
    name: 'pgs-raw-stream',
    tier: 1,
    file: 'pgs-raw-stream.sup',
    url: `${FATE}/sub/BluRay/Subpictures_20.sup`,
    licence: 'Unknown; fetched on demand and never redistributed',
    covers: 'A raw PGS stream outside any container, as a sidecar arrives',
  },
  {
    name: 'heaac-v2-aot5',
    tier: 1,
    file: 'heaac-v2-aot5.mp4',
    url: `${FRAUNHOFER}/SBRtestStereoAot5Sig1.mp4`,
    licence: 'Fraunhofer IIS test signal; no terms stated, fetched on demand',
    covers: 'HE-AAC v2 with explicit signalling, which the native AAC encoder cannot produce',
  },
  {
    name: 'heaac-v2-aot29',
    tier: 1,
    file: 'heaac-v2-aot29.mp4',
    url: `${FRAUNHOFER}/SBRtestStereoAot29Sig1.mp4`,
    licence: 'Fraunhofer IIS test signal; no terms stated, fetched on demand',
    covers: 'HE-AAC v2 signalled the other way, so profile detection cannot pass by luck',
  },
];

/**
 * Every fetched fixture at or below a tier.
 *
 * Nothing here is generated, because nothing here can be. PGS has a decoder in FFmpeg and no
 * encoder anywhere, and HE-AAC needs libfdk_aac, which the shipped build does not carry.
 *
 * Nor is any of it mirrored. ADR-0012 suggests re-hosting Tier 1 to protect against URL rot, which
 * assumed freely licensed material; these are test signals and clips of unstated provenance, so
 * they are fetched into the local cache on demand and never redistributed. The cost is that a dead
 * URL becomes a skipped test rather than a cached one, which is the right trade for material we
 * have no licence to serve.
 *
 * @param tier - The highest tier to include.
 * @returns The fixtures to fetch, in a stable order.
 */
const fetchedUpTo = (tier: FixtureTier): readonly FetchedFixture[] =>
  FETCHED.filter((fixture) => fixture.tier <= tier);

export type { FetchedFixture };

export { FETCHED, fetchedUpTo };
