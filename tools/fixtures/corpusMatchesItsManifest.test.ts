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
          '-show_format',
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
        expect(facts.scan).toBe(fixture.video.scan === 'interlaced' ? 'interlaced' : 'progressive');
      });

      it('carries the mastering metadata real HDR10 carries', () => {
        expect(facts.hasMasteringDisplay).toBe(fixture.video.range === 'HDR10');
      });

      it('is the size it claims', () => {
        expect([facts.width, facts.height]).toEqual([fixture.video.width, fixture.video.height]);
      });

      it('runs at the frame rate it claims', () => {
        const declared = fixture.video.frameRate;
        const expected =
          fixture.video.scan === 'telecined'
            ? 30
            : fixture.video.scan === 'interlaced'
              ? Math.round(declared / 2)
              : Math.round(declared);

        expect(facts.frameRate).toBe(expected);
      });

      it('carries the pixel shape it claims', () => {
        expect(facts.pixelAspect).toBe(fixture.video.pixelAspect);
      });

      it('carries the rotation it claims', () => {
        expect(facts.rotationDegrees).toBe(fixture.video.rotationDegrees);
      });

      it('starts where it claims to start', () => {
        const muxerClock = fixture.container === 'ts' ? 1 : 0;

        expect(facts.startSeconds).toBe(fixture.startOffsetSeconds + muxerClock);
      });

      it('carries the audio sample rate it claims', () => {
        expect(facts.audioSampleRate).toBe(fixture.audio.sampleRate);
      });

      it('carries the number of audio tracks it claims', () => {
        expect(facts.audioTrackCount).toBe(fixture.audio.tracks);
      });

      it('carries the audio codec it claims', () => {
        expect(facts.audioCodec).toBe(EXPECTED_AUDIO_NAMES[fixture.audio.codec]);
      });

      it('carries the channel count it claims', () => {
        expect(facts.audioChannels).toBe(fixture.audio.channels);
      });

      if (fixture.video.level !== '') {
        it('declares the codec level it claims', () => {
          expect(facts.level).toBe(Number(fixture.video.level.replace('.', '')));
        });
      }

      if (fixture.video.refFrames > 0) {
        it('encodes with the reference frame count it claims', () => {
          const trace = spawnSync(
            process.env['FLUX_FFMPEG'] ?? 'ffmpeg',
            [
              '-v',
              'trace',
              '-i',
              path,
              '-c',
              'copy',
              '-bsf:v',
              'trace_headers',
              '-t',
              '1',
              '-f',
              'null',
              '-',
            ],
            { encoding: 'utf8' },
          );

          const found = /max_num_ref_frames\s+[01]+ = (\d+)/.exec(trace.stderr);

          expect(Number(found?.[1] ?? 0)).toBe(fixture.video.refFrames);
        });
      }
    },
  );
});
