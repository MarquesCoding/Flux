const HAVE_METADATA = 1;

const HAVE_FUTURE_DATA = 3;

const ENOUGH_TO_START_SECONDS = 1.5;

type Player = {
  isSessionPlaying: boolean;
  readyState: number;
  currentSeconds: number;
  lastGoodSeconds: number;
  bufferedAheadSeconds: number;
  isPaused: boolean;
};

type Reported = {
  positionSeconds: number;
  isWatching: boolean;
  isReady: boolean;
};

/**
 * What to tell the room about this player.
 *
 * The important part is what it refuses to say. While a stream is being rebuilt — a quality change,
 * a different audio track, a fresh session — the element's position is not where the viewer is; it
 * is zero, or wherever the last stream left it. Reported as fact, that number is followed: the room
 * measures itself against whoever keeps time, so a host who has momentarily lost their place takes
 * everybody with them. The last position known to be real is reported instead, and the player says
 * plainly that it cannot play yet.
 *
 * Readiness asks the browser rather than counting seconds. A buffer target is the wrong question
 * near the end of a film, or at the end of what has been transcoded so far, where the buffer will
 * never reach it and the room would wait for a player that is in fact perfectly able to start.
 * `HAVE_FUTURE_DATA` is the browser's own answer to whether it could play now, which is the
 * question being asked; a comfortable buffer is accepted as well, for engines that are shy with it.
 *
 * @param player - What the element and its session currently say.
 * @returns What to report.
 */
const whatToReport = (player: Player): Reported => {
  const isSure = player.isSessionPlaying && player.readyState >= HAVE_METADATA;

  return {
    positionSeconds: isSure ? player.currentSeconds : player.lastGoodSeconds,
    isWatching: isSure && !player.isPaused,
    isReady:
      isSure &&
      (player.readyState >= HAVE_FUTURE_DATA ||
        player.bufferedAheadSeconds >= ENOUGH_TO_START_SECONDS),
  };
};

export type { Player, Reported };

export { whatToReport, HAVE_METADATA, HAVE_FUTURE_DATA, ENOUGH_TO_START_SECONDS };
