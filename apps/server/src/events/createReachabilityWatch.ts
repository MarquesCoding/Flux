type CreateReachabilityWatchOptions = {
  onLost: () => void;
  onRegained: () => void;
};

/**
 * Watches something that is checked over and over, and speaks up when it changes.
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
