import { describe, expect, it } from 'vitest';
import { accumulateWatchTime, watchedBetween, MOST_PER_GAP_SECONDS } from './accumulateWatchTime';
import type { Beat } from './accumulateWatchTime';

/**
 * A run of reports thirty seconds apart, playing, moving at ordinary speed.
 */
const steadily = (count: number, startAt = 0): Beat[] =>
  [...Array.from({ length: count }).keys()].map((at) => ({
    positionSeconds: startAt + at * 30,
    atMs: at * 30_000,
    isPlaying: true,
  }));

describe('watchedBetween', () => {
  it('counts ordinary playback as the time that passed', () => {
    expect(
      watchedBetween(
        { positionSeconds: 0, atMs: 0, isPlaying: true },
        { positionSeconds: 30, atMs: 30_000, isPlaying: true },
      ),
    ).toBe(30);
  });

  it('counts nothing while paused, however long it lasts', () => {
    expect(
      watchedBetween(
        { positionSeconds: 100, atMs: 0, isPlaying: false },
        { positionSeconds: 100, atMs: 3_600_000, isPlaying: false },
      ),
    ).toBe(0);
  });

  it('does not count a skipped intro as watched', () => {
    expect(
      watchedBetween(
        { positionSeconds: 30, atMs: 0, isPlaying: true },
        { positionSeconds: 120, atMs: 1_000, isPlaying: true },
      ),
    ).toBe(1);
  });

  it('discards a rewind rather than subtracting it', () => {
    expect(
      watchedBetween(
        { positionSeconds: 600, atMs: 0, isPlaying: true },
        { positionSeconds: 540, atMs: 30_000, isPlaying: true },
      ),
    ).toBe(0);
  });

  it('counts a slow gap by how far the content actually moved', () => {
    expect(
      watchedBetween(
        { positionSeconds: 0, atMs: 0, isPlaying: true },
        { positionSeconds: 5, atMs: 30_000, isPlaying: true },
      ),
    ).toBe(5);
  });

  it('credits a silent client one interval rather than the rest of the film', () => {
    expect(
      watchedBetween(
        { positionSeconds: 0, atMs: 0, isPlaying: true },
        { positionSeconds: 7_200, atMs: 7_200_000, isPlaying: true },
      ),
    ).toBe(MOST_PER_GAP_SECONDS);
  });

  it('counts nothing for two reports that arrived out of order', () => {
    expect(
      watchedBetween(
        { positionSeconds: 60, atMs: 60_000, isPlaying: true },
        { positionSeconds: 30, atMs: 30_000, isPlaying: true },
      ),
    ).toBe(0);
  });

  it('counts nothing for two reports at the same instant', () => {
    expect(
      watchedBetween(
        { positionSeconds: 0, atMs: 0, isPlaying: true },
        { positionSeconds: 30, atMs: 0, isPlaying: true },
      ),
    ).toBe(0);
  });
});

describe('accumulateWatchTime', () => {
  it('has nothing to count for a player that never reported', () => {
    expect(accumulateWatchTime([])).toBe(0);
  });

  it('has nothing to count from a single report, having no gap to measure', () => {
    expect(accumulateWatchTime(steadily(1))).toBe(0);
  });

  it('adds up an uninterrupted stretch', () => {
    expect(accumulateWatchTime(steadily(5))).toBe(120);
  });

  it('leaves out the part somebody was away for', () => {
    const beats: Beat[] = [
      { positionSeconds: 0, atMs: 0, isPlaying: true },
      { positionSeconds: 30, atMs: 30_000, isPlaying: false },
      { positionSeconds: 30, atMs: 1_830_000, isPlaying: true },
      { positionSeconds: 60, atMs: 1_860_000, isPlaying: true },
    ];

    expect(accumulateWatchTime(beats)).toBe(60);
  });

  it('counts a rewatched stretch each time it is watched', () => {
    const beats: Beat[] = [
      { positionSeconds: 0, atMs: 0, isPlaying: true },
      { positionSeconds: 30, atMs: 30_000, isPlaying: true },
      { positionSeconds: 0, atMs: 60_000, isPlaying: true },
      { positionSeconds: 30, atMs: 90_000, isPlaying: true },
    ];

    expect(accumulateWatchTime(beats)).toBe(60);
  });

  it('never counts more than the time that actually passed', () => {
    const beats: Beat[] = [
      { positionSeconds: 0, atMs: 0, isPlaying: true },
      { positionSeconds: 3_600, atMs: 30_000, isPlaying: true },
      { positionSeconds: 7_200, atMs: 60_000, isPlaying: true },
    ];

    expect(accumulateWatchTime(beats)).toBeLessThanOrEqual(60);
  });

  it('makes somebody who scrubbed to the end look nothing like somebody who watched it', () => {
    const scrubbed: Beat[] = [
      { positionSeconds: 0, atMs: 0, isPlaying: true },
      { positionSeconds: 7_200, atMs: 5_000, isPlaying: true },
    ];

    expect(accumulateWatchTime(scrubbed)).toBe(5);
    expect(accumulateWatchTime(steadily(20))).toBe(570);
  });
});
