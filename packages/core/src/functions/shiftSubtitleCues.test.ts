import { describe, expect, it } from 'vitest';
import { shiftSubtitleCues } from './shiftSubtitleCues';

const CUES = [
  { from: 1, to: 3, text: 'first' },
  { from: 10, to: 12, text: 'second' },
  { from: 20, to: 22, text: 'third' },
];

describe('lining subtitles up with a stream that starts partway in', () => {
  it('leaves them alone where the stream starts at the beginning', () => {
    expect(shiftSubtitleCues(CUES, 0)).toEqual(CUES);
  });

  it('moves every line back by as far in as the stream begins', () => {
    expect(shiftSubtitleCues(CUES, 10)).toEqual([
      { from: 0, to: 2, text: 'second' },
      { from: 10, to: 12, text: 'third' },
    ]);
  });

  it('drops a line that finished before the stream begins', () => {
    expect(shiftSubtitleCues(CUES, 5).map((cue) => cue.text)).toEqual(['second', 'third']);
  });

  it('keeps a line still on screen when the stream begins, clipped to the start', () => {
    expect(shiftSubtitleCues(CUES, 2)).toContainEqual({ from: 0, to: 1, text: 'first' });
  });

  it('keeps whatever else a line carries', () => {
    const [moved] = shiftSubtitleCues([{ from: 5, to: 6, isSign: true, spans: [] }], 1);

    expect(moved).toEqual({ from: 4, to: 5, isSign: true, spans: [] });
  });

  it('answers with nothing where the stream starts after everything is said', () => {
    expect(shiftSubtitleCues(CUES, 100)).toEqual([]);
  });
});
