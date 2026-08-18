import { describe, expect, it } from 'vitest';
import { describeRungCost } from './describeRungCost';

const AZKABAN_SECONDS = 142 * 60;

describe('describeRungCost', () => {
  it('gives both the rate and the size, since people reason in one or the other', () => {
    expect(describeRungCost({ maxBitrateKbps: 2500, durationSeconds: AZKABAN_SECONDS })).toBe(
      'up to 2.5 Mbps · ~2.7 GB',
    );
  });

  it('writes both as ceilings, because a rung caps rather than aims', () => {
    const shown = describeRungCost({ maxBitrateKbps: 4500, durationSeconds: AZKABAN_SECONDS });

    expect(shown.startsWith('up to ')).toBe(true);
    expect(shown).toContain('~');
  });

  it('drops to kbps where megabits would read as nought point something', () => {
    expect(describeRungCost({ maxBitrateKbps: 150, durationSeconds: AZKABAN_SECONDS })).toContain(
      'up to 150 kbps',
    );
  });

  it('drops to megabytes for something too small to be a sensible fraction of a gigabyte', () => {
    expect(describeRungCost({ maxBitrateKbps: 400, durationSeconds: 600 })).toBe(
      'up to 400 kbps · ~30 MB',
    );
  });

  it('gives the rate alone where the runtime was never read', () => {
    expect(describeRungCost({ maxBitrateKbps: 2500, durationSeconds: 0 })).toBe('up to 2.5 Mbps');
    expect(describeRungCost({ maxBitrateKbps: 2500, durationSeconds: Number.NaN })).toBe(
      'up to 2.5 Mbps',
    );
  });

  it('scales the size with the runtime rather than quoting one figure for everything', () => {
    const short = describeRungCost({ maxBitrateKbps: 2500, durationSeconds: 1800 });
    const long = describeRungCost({ maxBitrateKbps: 2500, durationSeconds: 10_800 });

    expect(short).not.toBe(long);
    expect(short).toContain('MB');
    expect(long).toContain('GB');
  });
});

describe('describeRungCost, the original', () => {
  it('states the file own bitrate plainly, rather than hedging against nothing', () => {
    const shown = describeRungCost({
      maxBitrateKbps: 80_657,
      durationSeconds: AZKABAN_SECONDS,
      isCeiling: false,
    });

    expect(shown.startsWith('up to')).toBe(false);
    expect(shown).toBe('80.7 Mbps · ~85.9 GB');
  });

  it('still hedges the size, which is derived rather than read off the file', () => {
    expect(
      describeRungCost({
        maxBitrateKbps: 80_657,
        durationSeconds: AZKABAN_SECONDS,
        isCeiling: false,
      }),
    ).toContain('~');
  });

  it('treats a rung as a ceiling unless told otherwise', () => {
    expect(describeRungCost({ maxBitrateKbps: 2500, durationSeconds: 100 })).toContain('up to');
  });
});
