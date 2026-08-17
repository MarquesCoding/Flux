const STOPPED_REPORTING_AFTER_MS = 5000;

type Reported = {
  positionSeconds: number;
  reportedAtMs: number;
  isWatching: boolean;
};

/**
 * Where the room has got to now, from where it said it was a moment ago.
 *
 * A position arrives stamped with when it was measured and is out of date by the time it is read —
 * by the reporting interval plus whatever the network added. Taken at face value it puts everybody
 * who follows it permanently behind the person keeping time, and no amount of drift correction can
 * close a gap it is being told does not exist. So the elapsed time is added back.
 *
 * Only while they are watching. A paused picture stays where it is, and adding elapsed time to it
 * would invent progress nobody made.
 *
 * The extrapolation is capped, because a tab that has stopped reporting — asleep, closed, or wedged
 * — is not a tab that is still playing. Past that point the last real reading is a better answer
 * than a guess that grows without limit.
 *
 * @param reported - What the room last said about itself.
 * @param atMs - Now, on the same clock the report was stamped with.
 * @returns Where to treat the room as being.
 */
const whereTheRoomIs = (reported: Reported, atMs: number): number => {
  if (!reported.isWatching) {
    return reported.positionSeconds;
  }

  const elapsedMs = Math.min(Math.max(0, atMs - reported.reportedAtMs), STOPPED_REPORTING_AFTER_MS);

  return reported.positionSeconds + elapsedMs / 1000;
};

export type { Reported };

export { whereTheRoomIs, STOPPED_REPORTING_AFTER_MS };
