import type { SubtitleCue } from '@ValenceClient/playback/fetchSubtitleCues';

/**
 * Finds every line on screen at a moment.
 *
 * More than one can be, which is the ordinary case for a script rather than an edge of it: a sign on
 * a shop window stays up while the people in front of it go on talking, and both belong on screen at
 * once. A plain subtitle file rarely overlaps itself, and nothing breaks where it does.
 *
 * @param cues - The lines.
 * @param atSeconds - Where playback is up to.
 * @returns Everything said or shown then, in the order the file has it.
 */
const linesAt = (cues: readonly SubtitleCue[], atSeconds: number): SubtitleCue[] =>
  cues.filter((cue) => atSeconds >= cue.from && atSeconds < cue.to);

export { linesAt };
