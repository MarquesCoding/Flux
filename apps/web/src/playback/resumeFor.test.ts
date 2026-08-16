import { describe, expect, it } from 'vitest';
import { resumeFor } from './resumeFor';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

const progress = (positionSeconds: number, isFinished = false): Map<string, WatchProgress> =>
  new Map([
    [
      'a',
      {
        mediaId: 'a',
        positionSeconds,
        durationSeconds: 7200,
        isFinished,
        updatedAt: '2026-08-15T00:00:00.000Z',
      },
    ],
  ]);

describe('resumeFor', () => {
  it('offers the position somebody got to', () => {
    expect(resumeFor(progress(2400), 'a')).toBe(2400);
  });

  it('offers nothing for something barely started', () => {
    expect(resumeFor(progress(20), 'a')).toBeNull();
  });

  it('offers nothing for something finished', () => {
    expect(resumeFor(progress(7150, true), 'a')).toBeNull();
  });

  it('offers nothing for something never watched', () => {
    expect(resumeFor(progress(2400), 'b')).toBeNull();
  });
});
