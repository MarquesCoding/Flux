type CreateReachabilityWatchOptions = {
  onLost: () => void;
};

/**
 * Watches something that is checked over and over, and speaks up on the way
 * down.
 *
 * The difference this makes is the difference between a useful alert and one
 * people turn off. A check that runs every five minutes and announces every
 * failure sends twelve messages an hour for as long as the thing is down, and
 * the twelfth is not news — it is the reason somebody mutes the channel and
 * then misses the next real outage.
 *
 * So this reports the transition rather than the state: the first check that
 * fails after a check that passed, and nothing more until it recovers.
 *
 * Recovery is watched but not announced, because there is no event for it in
 * the catalogue yet. What recovery does is re-arm this, so the next outage is
 * announced like the first one was.
 *
 * Held in memory, which means a server that restarts while the transcoder is
 * down will announce it once more on the first failed check after boot. That
 * is the right way round: repeating an outage that is still happening is a
 * far smaller problem than staying silent about one because of what a
 * previous process believed.
 *
 * @param onLost Called once, when something that was reachable stops being.
 */
const createReachabilityWatch = ({ onLost }: CreateReachabilityWatchOptions) => {
  let wasReachable = true;

  return {
    record: (reachable: boolean): void => {
      if (wasReachable && !reachable) {
        onLost();
      }

      wasReachable = reachable;
    },
  };
};

export { createReachabilityWatch };
