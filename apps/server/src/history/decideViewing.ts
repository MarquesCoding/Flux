type OpenViewing = {
  id: string;
  lastWatchedAt: Date;
  secondsWatched: number;
  isFinished: boolean;
};

type Observation = {
  at: Date;
  secondsWatched: number;
  isFinished: boolean;
};

const SAME_VIEWING_MILLISECONDS = 6 * 60 * 60 * 1000;

const WORTH_REMEMBERING_SECONDS = 60;

type Decision =
  | { kind: 'ignore' }
  | { kind: 'open'; secondsWatched: number; isFinished: boolean }
  | { kind: 'extend'; id: string; secondsWatched: number; isFinished: boolean };

/**
 * Decides what one report of watching does to the history: start a new viewing, extend the one in
 * progress, or be ignored. Somebody who pauses for ten minutes and carries on has watched one thing,
 * not two, and somebody who opens a film and closes it has not watched it at all.
 *
 * @param open - What was reported: which item, where in it, and when.
 * @param seen - The viewing already in progress, where there is one.
 * @returns What to do with it.
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

export type { OpenViewing };

export { decideViewing, SAME_VIEWING_MILLISECONDS, WORTH_REMEMBERING_SECONDS };
