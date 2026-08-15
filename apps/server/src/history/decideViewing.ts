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
 * Decides what a moment of watching does to the history.
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
