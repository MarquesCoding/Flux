import { describe, expect, it } from 'vitest';
import { linesAt } from './linesAt';
import type { SubtitleCue } from '@ValenceClient/playback/fetchSubtitleCues';

const cueOf = (from: number, to: number, isSign = false): SubtitleCue => ({
  from,
  to,
  spans: [],
  alignment: 2,
  position: null,
  margins: { left: 0, right: 0, vertical: 0 },
  isSign,
  ...(isSign ? {} : {}),
});

const CUES = [cueOf(0, 10, true), cueOf(2, 4), cueOf(20, 22)];

describe('what is on screen at a moment', () => {
  it('shows a sign and the talking over it at the same time', () => {
    expect(linesAt(CUES, 3)).toHaveLength(2);
  });

  it('shows the sign alone once the talking stops', () => {
    const said = linesAt(CUES, 5);

    expect(said).toHaveLength(1);
    expect(said[0]?.isSign).toBe(true);
  });

  it('shows nothing in a gap', () => {
    expect(linesAt(CUES, 15)).toEqual([]);
  });

  it('ends a line the moment it is over rather than a frame later', () => {
    expect(linesAt([cueOf(1, 2)], 2)).toEqual([]);
    expect(linesAt([cueOf(1, 2)], 1)).toHaveLength(1);
  });
});
