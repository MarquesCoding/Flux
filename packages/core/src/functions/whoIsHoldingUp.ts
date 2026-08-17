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
 * @param members - Everybody in the party.
 * @param timekeeperId - Whoever keeps time, whose position the rest are measured against.
 * @param atMs - Now, on the clock the reports were stamped with.
 * @returns Whoever is not ready, in the order they appear in the party.
 */
const whoIsHoldingUp = (
  members: readonly Watcher[],
  timekeeperId: string | null,
  atMs: number,
): readonly Watcher[] => {
  const timekeeper = members.find((member) => member.connectionId === timekeeperId);

  if (timekeeper === undefined) {
    return [];
  }

  const reference = whereTheRoomIs(timekeeper, atMs);

  return members.filter(
    (member) =>
      !member.isReady ||
      Math.abs(whereTheRoomIs(member, atMs) - reference) > TOGETHER_WITHIN_SECONDS,
  );
};

export type { Watcher };

export { whoIsHoldingUp, TOGETHER_WITHIN_SECONDS };
