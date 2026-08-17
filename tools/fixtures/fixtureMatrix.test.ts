import { describe, expect, it } from 'vitest';
import { FIXTURES, fixtureFileName, fixturesUpTo, GENERATED_LICENCE } from './fixtureMatrix';

describe('FIXTURES', () => {
  it('names every fixture only once', () => {
    const names = FIXTURES.map((fixture) => fixture.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('records a licence for every fixture', () => {
    expect(FIXTURES.every((fixture) => fixture.licence.length > 0)).toBe(true);
  });

  it('generates the whole of tier zero rather than downloading any of it', () => {
    const tierZero = FIXTURES.filter((fixture) => fixture.tier === 0);

    expect(tierZero.every((fixture) => fixture.licence === GENERATED_LICENCE)).toBe(true);
    expect(tierZero.length).toBe(FIXTURES.length);
  });

  it('varies the GOP structure, which is the axis that was never varied before', () => {
    const open = FIXTURES.filter((fixture) => fixture.video.gop === 'open');
    const closed = FIXTURES.filter((fixture) => fixture.video.gop === 'closed');

    expect(open.length).toBeGreaterThan(0);
    expect(closed.length).toBeGreaterThan(0);
  });

  it('covers both codecs that can carry an open GOP', () => {
    const openCodecs = new Set(
      FIXTURES.filter((fixture) => fixture.video.gop === 'open').map(
        (fixture) => fixture.video.codec,
      ),
    );

    expect(openCodecs.has('h264')).toBe(true);
    expect(openCodecs.has('hevc')).toBe(true);
  });

  it('covers every audio codec the support matrix claims', () => {
    const codecs = new Set(FIXTURES.map((fixture) => fixture.audio.codec));

    for (const codec of ['aac', 'ac3', 'eac3', 'truehd', 'dts', 'opus', 'flac'] as const) {
      expect(codecs.has(codec)).toBe(true);
    }
  });

  it('covers keyframes both close together and far apart', () => {
    const spacings = new Set(FIXTURES.map((fixture) => fixture.video.keyframeSeconds));

    expect(spacings.size).toBeGreaterThan(1);
  });

  it('puts a webm fixture behind vp9 and opus, which is all webm carries', () => {
    const webm = FIXTURES.filter((fixture) => fixture.container === 'webm');

    expect(webm.every((fixture) => fixture.video.codec === 'vp9')).toBe(true);
    expect(webm.every((fixture) => fixture.audio.codec === 'opus')).toBe(true);
  });
});

describe('fixturesUpTo', () => {
  it('includes the lower tiers when a higher one is asked for', () => {
    expect(fixturesUpTo(2).length).toBeGreaterThanOrEqual(fixturesUpTo(0).length);
  });

  it('gives every generated fixture at tier zero', () => {
    expect(fixturesUpTo(0).length).toBe(FIXTURES.length);
  });
});

describe('fixtureFileName', () => {
  it('names a file after the fixture and its container', () => {
    expect(fixtureFileName({ ...FIXTURES[0]!, name: 'thing', container: 'mkv' })).toBe('thing.mkv');
  });
});
