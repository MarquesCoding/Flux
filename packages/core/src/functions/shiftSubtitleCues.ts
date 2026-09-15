type ShiftableCue = {
  from: number;
  to: number;
};

/**
 * Moves every line so it lines up with a stream that begins partway into the film, which is what a
 * session started at a resume point delivers.
 *
 * A line still on screen when the stream begins is kept and clipped to the start rather than dropped,
 * since half of a sentence is better than the viewer wondering what was said. A line finished before
 * then goes, because it belongs to a part of the film this stream does not contain.
 *
 * @param cues - The lines, as the file has them.
 * @param seconds - How far into the film the stream begins.
 * @returns The lines that fall inside the stream, moved back.
 */
const shiftSubtitleCues = <T extends ShiftableCue>(cues: readonly T[], seconds: number): T[] => {
  if (seconds === 0) {
    return [...cues];
  }

  return cues
    .filter((cue) => cue.to - seconds > 0)
    .map((cue) => ({ ...cue, from: Math.max(cue.from - seconds, 0), to: cue.to - seconds }));
};

export type { ShiftableCue };

export { shiftSubtitleCues };
