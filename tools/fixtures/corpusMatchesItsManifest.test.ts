import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureFacts } from './fixtureFacts';
import { fixtureFileName, FIXTURES } from './fixtureMatrix';
import { fixturesDirectoryHere } from './fixturesDirectory';

const EXPECTED_CODEC_NAMES: Record<string, string> = {
  h264: 'h264',
  hevc: 'hevc',
  av1: 'av1',
  vp9: 'vp9',
};

const EXPECTED_AUDIO_NAMES: Record<string, string> = {
  aac: 'aac',
  ac3: 'ac3',
  eac3: 'eac3',
  truehd: 'truehd',
  dts: 'dts',
  opus: 'opus',
  flac: 'flac',
};

const directory = fixturesDirectoryHere();

const present = FIXTURES.filter((fixture) => existsSync(join(directory, fixtureFileName(fixture))));

const missing = FIXTURES.length - present.length;

describe('the corpus matches what the matrix claims', () => {
  it('has been built', { skip: present.length === 0 }, () => {
    expect(present.length).toBe(FIXTURES.length);
  });

  if (present.length === 0) {
    it.skip(`skipped: no fixtures in ${directory}. Build them with \`pnpm fixtures:sync\`.`, () =>
      undefined);

    return;
  }

  if (missing > 0) {
    it.skip(`skipped ${missing.toString()} absent fixtures. Rebuild them with \`pnpm fixtures:sync\`.`, () =>
      undefined);
  }

  describe.each(present.map((fixture) => ({ fixture, name: fixture.name })))(
    '$name',
    ({ fixture }) => {
      const path = join(directory, fixtureFileName(fixture));

      const probe = spawnSync(
        process.env['FLUX_FFPROBE'] ?? 'ffprobe',
        [
          '-v',
          'error',
          '-show_streams',
          '-show_frames',
          '-read_intervals',
          '%+#1',
          '-of',
          'json',
          path,
        ],
        { encoding: 'utf8' },
      );

      const facts = fixtureFacts(probe.stdout);

      it('carries the video codec it claims', () => {
        expect(facts.videoCodec).toBe(EXPECTED_CODEC_NAMES[fixture.video.codec]);
      });

      it('carries the bit depth it claims', () => {
        expect(facts.bitDepth).toBe(fixture.video.bitDepth);
      });

      it('carries the range it claims', () => {
        expect(facts.range).toBe(fixture.video.range);
      });

      it('carries the scan it claims', () => {
        expect(facts.scan).toBe(fixture.video.scan);
      });

      it('carries the mastering metadata real HDR10 carries', () => {
        expect(facts.hasMasteringDisplay).toBe(fixture.video.range === 'HDR10');
      });

      it('carries the audio codec it claims', () => {
        expect(facts.audioCodec).toBe(EXPECTED_AUDIO_NAMES[fixture.audio.codec]);
      });

      it('carries the channel count it claims', () => {
        expect(facts.audioChannels).toBe(fixture.audio.channels);
      });
    },
  );
});
