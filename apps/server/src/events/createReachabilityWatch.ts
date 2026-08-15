type CreateReachabilityWatchOptions = {
  onLost: () => void;
  onRegained: () => void;
};

/**
 * Watches something that is checked over and over, and speaks up when it
 * changes.
 *
 * The difference this makes is the difference between a useful alert and one
 * people turn off. A check that runs every five minutes and announces every
 * failure sends twelve messages an hour for as long as the thing is down, and
 * the twelfth is not news — it is the reason somebody mutes the channel and
 * then misses the next real outage.
 *
 * So this reports transitions rather than state: the first check that fails
 * after one that passed, and the first that passes after one that failed.
 * Nothing in between, however long either lasts.
 *
 * Both directions matter, and the second is not decoration. Being told the
 * transcoder stopped answering and then hearing nothing leaves somebody
 * unable to tell a blip from an outage still running at midnight, which sends
 * them to the admin page — the thing notifications existed to avoid.
 *
 * A watch begins believing everything is fine, so a server that starts up
 * healthy announces nothing. That also means one which restarts while
 * something is down announces the outage once more on the first failed check
 * after boot. That is the right way round: repeating an outage that is still
 * happening is a far smaller problem than staying silent about one because of
 * what a previous process believed.
 *
 * @param onLost Called once, when something that was reachable stops being.
 * @param onRegained Called once, when something that was lost answers again.
 */
const createReachabilityWatch = ({ onLost, onRegained }: CreateReachabilityWatchOptions) => {
  let wasReachable = true;

  return {
    record: (reachable: boolean): void => {
      if (wasReachable && !reachable) {
        onLost();
      }

      if (!wasReachable && reachable) {
        onRegained();
      }

      wasReachable = reachable;
    },
  };
};

export { createReachabilityWatch };
