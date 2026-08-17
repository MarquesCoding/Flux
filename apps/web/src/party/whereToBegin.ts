const WAIT_FOR_THE_ROOM_MS = 5000;

type Beginning = { kind: 'wait' } | { kind: 'begin'; atSeconds: number };

type Arrival = {
  invitedTo: string | null;
  joined: string | null;
  roomSeconds: number | null;
  resumeSeconds: number;
  isBeingAsked: boolean;
  hasWaitedLongEnough: boolean;
};

/**
 * Where a viewer should start, when they may be arriving into a party that is already running.
 *
 * The room wins over where this account had got to on its own. Somebody joining a party halfway
 * through a film wants the film where everybody else is, not where they left it last Tuesday — and
 * starting at their own position then seeking is worse than starting in the right place, because
 * the playback session is opened at whatever second it is told and moving afterwards costs a
 * rebuffer.
 *
 * Which means waiting: the room's position arrives over the socket a moment after the page opens,
 * so there is nothing to start at yet. The wait is bounded, because a party that never answers must
 * not leave somebody looking at a loading screen — past that point their own position is a worse
 * answer than the room's but a far better one than nothing.
 *
 * Whoever is keeping time is not waiting for anybody. They are the reference, so they begin where
 * they always would. Neither is anybody the party has asked something of — a password prompt behind
 * a loading screen is a question nobody can answer.
 *
 * @param arrival - The party in the address, the party actually joined, where the room is, where this account had got to, and whether the wait has run out.
 * @returns Where to begin, or that it is worth waiting a moment longer.
 */
const whereToBegin = (arrival: Arrival): Beginning => {
  if (arrival.invitedTo === null) {
    return { kind: 'begin', atSeconds: arrival.resumeSeconds };
  }

  if (arrival.roomSeconds !== null) {
    return { kind: 'begin', atSeconds: arrival.roomSeconds };
  }

  if (arrival.joined === arrival.invitedTo || arrival.isBeingAsked || arrival.hasWaitedLongEnough) {
    return { kind: 'begin', atSeconds: arrival.resumeSeconds };
  }

  return { kind: 'wait' };
};

export type { Beginning, Arrival };

export { whereToBegin, WAIT_FOR_THE_ROOM_MS };
