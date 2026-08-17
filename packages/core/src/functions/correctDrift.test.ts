import { describe, expect, it } from 'vitest';
import { MOST_RATE_CHANGE, SNAP_BEYOND_MS, correctDrift, deadBandFor } from './correctDrift';

const steady = { jitterMs: 0, isSeeking: false, isStalled: false };

describe('correctDrift', () => {
  it('leaves a picture alone while it is close enough', () => {
    expect(correctDrift({ ...steady, behindByMs: 100 })).toStrictEqual({ kind: 'leave alone' });
  });

  it('leaves a picture alone when it is exactly on time', () => {
    expect(correctDrift({ ...steady, behindByMs: 0 })).toStrictEqual({ kind: 'leave alone' });
  });

  it('nudges the rate up for a picture that has fallen behind', () => {
    const corrected = correctDrift({ ...steady, behindByMs: 500 });

    expect(corrected.kind).toBe('rate');
    expect(corrected.kind === 'rate' ? corrected.rate : 1).toBeGreaterThan(1);
  });

  it('nudges the rate down for a picture that has run ahead', () => {
    const corrected = correctDrift({ ...steady, behindByMs: -500 });

    expect(corrected.kind === 'rate' ? corrected.rate : 1).toBeLessThan(1);
  });

  it('never nudges further than a viewer would fail to notice', () => {
    const corrected = correctDrift({ ...steady, behindByMs: SNAP_BEYOND_MS });

    expect(corrected.kind === 'rate' ? corrected.rate : 1).toBeLessThanOrEqual(
      1 + MOST_RATE_CHANGE,
    );
  });

  it('nudges harder the further out it is', () => {
    const gentle = correctDrift({ ...steady, behindByMs: 300 });
    const firmer = correctDrift({ ...steady, behindByMs: 900 });

    expect(firmer.kind === 'rate' ? firmer.rate : 0).toBeGreaterThan(
      gentle.kind === 'rate' ? gentle.rate : 0,
    );
  });

  it('snaps rather than crawling back from hopelessly far out', () => {
    expect(correctDrift({ ...steady, behindByMs: 4000 })).toStrictEqual({ kind: 'snap' });
  });

  it('snaps whichever side it is out on', () => {
    expect(correctDrift({ ...steady, behindByMs: -4000 })).toStrictEqual({ kind: 'snap' });
  });

  it('does nothing while the picture is already seeking, rather than fighting it', () => {
    expect(correctDrift({ ...steady, behindByMs: 4000, isSeeking: true })).toStrictEqual({
      kind: 'leave alone',
    });
  });

  it('does nothing while it has run out of buffer, rather than fighting that', () => {
    expect(correctDrift({ ...steady, behindByMs: 800, isStalled: true })).toStrictEqual({
      kind: 'leave alone',
    });
  });

  it('tolerates an unsteady connection instead of chasing its noise', () => {
    const onFibre = correctDrift({ ...steady, behindByMs: 250 });
    const onMobile = correctDrift({ ...steady, behindByMs: 250, jitterMs: 400 });

    expect(onFibre.kind).toBe('rate');
    expect(onMobile.kind).toBe('leave alone');
  });

  it('still snaps somebody hopelessly out however unsteady their connection', () => {
    expect(correctDrift({ ...steady, behindByMs: 4000, jitterMs: 800 })).toStrictEqual({
      kind: 'snap',
    });
  });
});

describe('deadBandFor', () => {
  it('is generous enough on a steady connection to not hunt', () => {
    expect(deadBandFor(0)).toBeGreaterThan(0);
  });

  it('widens as the measurements get less steady', () => {
    expect(deadBandFor(400)).toBeGreaterThan(deadBandFor(0));
  });

  it('ignores a nonsensical jitter rather than narrowing the band', () => {
    expect(deadBandFor(-100)).toBe(deadBandFor(0));
  });
});
