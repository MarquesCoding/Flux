import { describe, expect, it } from 'vitest';
import { estimateDownloadBytes } from './estimateDownloadBytes';

const A_FILM = { durationSeconds: 7200, sizeBytes: 60_000_000_000 };

describe('estimateDownloadBytes', () => {
  it('gives the original exactly, since its size is recorded rather than guessed', () => {
    expect(estimateDownloadBytes({ ...A_FILM, quality: 'original' })).toBe(60_000_000_000);
  });

  it('says nothing about an original whose size was never recorded', () => {
    expect(estimateDownloadBytes({ ...A_FILM, sizeBytes: 0, quality: 'original' })).toBeNull();
  });

  it('estimates a rung from its ceiling and the runtime', () => {
    expect(estimateDownloadBytes({ ...A_FILM, quality: '1080p' })).toBe(4_050_000_000);
  });

  it('estimates a smaller rung smaller', () => {
    const at1080 = estimateDownloadBytes({ ...A_FILM, quality: '1080p' }) ?? 0;
    const at480 = estimateDownloadBytes({ ...A_FILM, quality: '480p' }) ?? 0;

    expect(at480).toBeLessThan(at1080);
  });

  it('leans high, so what arrives is smaller than what was promised rather than larger', () => {
    const promised = estimateDownloadBytes({ ...A_FILM, quality: '1080p' }) ?? 0;
    const spentInFull = (4500 * 1000 * A_FILM.durationSeconds) / 8;

    expect(promised).toBeGreaterThanOrEqual(spentInFull);
  });

  it('says nothing where the runtime is not known, rather than estimating from nothing', () => {
    expect(estimateDownloadBytes({ ...A_FILM, durationSeconds: 0, quality: '1080p' })).toBeNull();
  });
});
