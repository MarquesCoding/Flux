import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DERIVED } from './derivedFixtures';
import { FETCHED } from './fetchedFixtures';
import { fixturesDirectoryHere } from './fixturesDirectory';

const directory = fixturesDirectoryHere();

const present = FETCHED.filter((fixture) => existsSync(join(directory, fixture.file)));

const streamsOf = (path: string): string =>
  spawnSync(
    process.env['FLUX_FFPROBE'] ?? 'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_name,profile', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  ).stdout;

describe('the fetched corpus is what it claims', () => {
  if (present.length === 0) {
    it.skip(`skipped: nothing fetched into ${directory}. Fetch it with \`pnpm fixtures:sync --tier 1\`.`, () =>
      undefined);

    return;
  }

  it('records where every fetched fixture came from and on what terms', () => {
    expect(FETCHED.every((fixture) => fixture.url.startsWith('https://'))).toBe(true);
    expect(FETCHED.every((fixture) => fixture.licence.length > 0)).toBe(true);
    expect(FETCHED.every((fixture) => fixture.covers.length > 0)).toBe(true);
  });

  const bitmapSubtitles = present.filter((fixture) => fixture.name.startsWith('pgs'));

  describe.each(bitmapSubtitles.map((fixture) => ({ fixture, name: fixture.name })))(
    '$name',
    ({ fixture }) => {
      it('carries a bitmap subtitle stream FFmpeg can only decode', () => {
        expect(streamsOf(join(directory, fixture.file))).toContain('hdmv_pgs_subtitle');
      });
    },
  );

  const highEfficiencyAudio = present.filter((fixture) => fixture.name.startsWith('heaac'));

  describe.each(highEfficiencyAudio.map((fixture) => ({ fixture, name: fixture.name })))(
    '$name',
    ({ fixture }) => {
      it('carries an AAC profile the native encoder cannot produce', () => {
        expect(streamsOf(join(directory, fixture.file))).toContain('HE-AAC');
      });
    },
  );

  const bitmapFormats: Record<string, string> = {
    'pgs-subtitles.mkv': 'hdmv_pgs_subtitle',
    'vobsub-subtitles.mkv': 'dvd_subtitle',
    'dvbsub-subtitles.mkv': 'dvb_subtitle',
  };

  const derived = DERIVED.filter((fixture) => existsSync(join(directory, fixture.file)));

  describe.each(derived.map((fixture) => ({ fixture, name: fixture.name })))(
    '$name',
    ({ fixture }) => {
      it('carries the bitmap format it was derived into', () => {
        expect(streamsOf(join(directory, fixture.file))).toContain(
          bitmapFormats[fixture.file] ?? 'unknown',
        );
      });
    },
  );

  it('covers all three bitmap subtitle formats the schema claims', () => {
    const covered = [...FETCHED, ...DERIVED]
      .filter((fixture) => existsSync(join(directory, fixture.file)))
      .map((fixture) => bitmapFormats[fixture.file])
      .filter((codec): codec is string => codec !== undefined);

    expect(new Set(covered)).toEqual(
      new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle']),
    );
  });

  it('covers both HE-AAC signalling modes rather than one twice', () => {
    const profiles = highEfficiencyAudio.map((fixture) =>
      streamsOf(join(directory, fixture.file)).trim(),
    );

    expect(new Set(profiles).size).toBe(profiles.length);
  });
});
