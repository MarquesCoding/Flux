/**
 * A viewing already open for this profile and item, if there is one.
 */
type OpenViewing = {
  id: string;
  /**
   * When somebody last did anything to it.
   */
  lastWatchedAt: Date;
  secondsWatched: number;
  isFinished: boolean;
};

/**
 * What has just been observed about somebody watching something.
 */
type Observation = {
  at: Date;
  /**
   * How much watching has happened since the last observation, already
   * measured honestly — a rewind is not negative and a skipped intro is not
   * counted. See `accumulateWatchTime`.
   */
  secondsWatched: number;
  isFinished: boolean;
};

/**
 * How long a gap makes it a different viewing.
 *
 * Starting the same episode three times in one evening is one viewing, not
 * three: somebody who pauses to make tea, or closes a tab and reopens it, has
 * not watched the thing again. Coming back the next day has.
 *
 * Six hours rather than a calendar day, so that finishing something at one in
 * the morning and starting it again that evening reads as two viewings — which
 * is what it is — while an interrupted evening stays one.
 */
const SAME_VIEWING_MILLISECONDS = 6 * 60 * 60 * 1000;

/**
 * How much watching makes it worth remembering at all.
 *
 * Opening something, deciding against it and closing it is not a thing
 * somebody watched, and a history full of those is a history nobody reads. A
 * minute is long enough to have formed an opinion and short enough not to lose
 * a genuine false start.
 *
 * Finishing counts however little was watched, because somebody who skipped to
 * the end has still finished it, and a log that disagreed with the resume
 * pointer about that would be a log nobody trusts.
 */
const WORTH_REMEMBERING_SECONDS = 60;

type Decision =
  | { kind: 'ignore' }
  | { kind: 'open'; secondsWatched: number; isFinished: boolean }
  | { kind: 'extend'; id: string; secondsWatched: number; isFinished: boolean };

/**
 * Decides what a moment of watching does to the history.
 *
 * Three answers, and the distinction between them is the whole of what makes
 * this log useful rather than noisy:
 *
 * - **Ignore** it. Too little watching, and nothing already open to add it to.
 * - **Extend** the viewing that is already open, because this is the same sitting.
 * - **Open** a new one, because enough time has passed that it is not.
 *
 * Kept apart from the storing so the rules can be read in one place and argued
 * with. They are judgements rather than facts, and a judgement buried in a
 * query is a judgement nobody revisits.
 */
const decideViewing = (open: OpenViewing | null, seen: Observation): Decision => {
  const isSameSitting =
    open !== null &&
    Math.abs(seen.at.getTime() - open.lastWatchedAt.getTime()) < SAME_VIEWING_MILLISECONDS;

  if (isSameSitting) {
    return {
      kind: 'extend',
      id: open.id,
      secondsWatched: open.secondsWatched + seen.secondsWatched,
      isFinished: open.isFinished || seen.isFinished,
    };
  }

  if (seen.isFinished || seen.secondsWatched >= WORTH_REMEMBERING_SECONDS) {
    return { kind: 'open', secondsWatched: seen.secondsWatched, isFinished: seen.isFinished };
  }

  return { kind: 'ignore' };
};

export type { OpenViewing, Observation, Decision };

export { decideViewing, SAME_VIEWING_MILLISECONDS, WORTH_REMEMBERING_SECONDS };
