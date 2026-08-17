import { whereTheRoomIs } from './whereTheRoomIs';

const TOGETHER_WITHIN_SECONDS = 2;

type Watcher = {
  connectionId: string;
  name: string;
  isReady: boolean;
  isWatching: boolean;
  positionSeconds: number;
  reportedAtMs: number;
};

/**
 * Who the room is waiting for: anybody who cannot play what everybody else is about to.
 *
 * A party is not in step because everybody pressed play at the same moment. One person may be
 * transcoding while another direct streams, one may have just changed quality and be starting a
 * fresh stream, one may be on a connection that cannot keep up. Left alone, the difference is
 * permanent — the player that could not start simply begins late and stays late, and no amount of
 * drift correction closes a gap that opens faster than it can be closed.
 *
 * So the room waits. Somebody holds it up if they have nothing buffered to play, or if they are not
 * where everybody else is — both matter, because a member sitting a minute behind with a full buffer
 * is as out of step as one with an empty buffer.
 *
 * Waiting is measured against whoever keeps time rather than against an average, so every client
 * works out the same answer from the same party.
 *
 * Somebody who has not been heard from since the last thing that moved the picture holds it up too,
 * because nothing they last said is worth believing: a position measured before a skip describes a
 * different film. They are waited for rather than guessed at, and they answer within a second.
 *
 * Where the timekeeper is the one who cannot play, nobody is judged against their position at all.
 * A player whose stream is being rebuilt does not know where it is, and measuring the room against
 * somebody who has lost their place would send everybody to the wrong one.
 *
 * @param members - Everybody in the party.
 * @param timekeeperId - Whoever keeps time, whose position the rest are measured against.
 * @param atMs - Now, on the clock the reports were stamped with.
 * @param movedAtMs - When the picture was last moved by a command, or null where nothing has moved it.
 * @returns Whoever is not ready, in the order they appear in the party.
 */
const whoIsHoldingUp = (
  members: readonly Watcher[],
  timekeeperId: string | null,
  atMs: number,
  movedAtMs: number | null = null,
): readonly Watcher[] => {
  const timekeeper = members.find((member) => member.connectionId === timekeeperId);

  if (timekeeper === undefined) {
    return [];
  }

  const isStale = (member: Watcher): boolean =>
    movedAtMs !== null && member.reportedAtMs < movedAtMs;

  const reference = whereTheRoomIs(timekeeper, atMs);
  const isReferenceWorthComparing = !isStale(timekeeper) && timekeeper.isReady;

  return members.filter(
    (member) =>
      isStale(member) ||
      !member.isReady ||
      (isReferenceWorthComparing &&
        Math.abs(whereTheRoomIs(member, atMs) - reference) > TOGETHER_WITHIN_SECONDS),
  );
};

export type { Watcher };

export { whoIsHoldingUp, TOGETHER_WITHIN_SECONDS };
