import type { AskingTheServer } from '@ValenceDesktop/main/keepADownload';

type ServerReach = {
  isReachable: () => boolean;
  noteReached: () => void;
  noteMissed: () => void;
  whenChanged: (listener: (isReachable: boolean) => void) => () => void;
  stop: () => void;
};

type WhatReachNeeds = {
  where: () => string;
  fetching: AskingTheServer;
  every: number;
};

/**
 * Whether Valence is answering, kept up to date by the process that does the asking.
 *
 * This client is the only one that can say honestly. Every request the window makes goes through
 * the main process on its way to the server, so a connection that could not be made is seen here
 * first and seen as what it is — rather than arriving in a screen as a failed query indistinguishable
 * from a server that answered badly. A browser has nothing better than whether the machine has a
 * network at all, which is a different question.
 *
 * A refusal is not a miss. A server that answers at all is reachable, whatever it says: an item
 * nobody may see and an item that does not exist are both replies, and treating either as a
 * disappearance would drop somebody into offline mode over a typo in an address.
 *
 * While it is out of reach this asks quietly on a timer, because nothing else will. Offline mode
 * stops the application making the requests that would otherwise notice the server coming back, so
 * without this a laptop that reconnected would sit on a shelf of downloads until somebody restarted
 * it. While it is reachable nothing is polled — the application's own traffic is a better and
 * cheaper signal than a heartbeat.
 *
 * @param needs - Where the server is, how to ask, and how often to try while it is not there.
 * @returns What is known about reach, and the two ways of telling it something.
 */
const theServerReach = (needs: WhatReachNeeds): ServerReach => {
  const listeners = new Set<(isReachable: boolean) => void>();

  let isReachable = true;
  let asking: ReturnType<typeof setTimeout> | null = null;

  const stopAsking = (): void => {
    if (asking !== null) {
      clearTimeout(asking);
      asking = null;
    }
  };

  const settle = (nowReachable: boolean): void => {
    if (nowReachable === isReachable) {
      return;
    }

    isReachable = nowReachable;

    for (const listener of listeners) {
      listener(nowReachable);
    }

    if (nowReachable) {
      stopAsking();
    } else {
      keepAsking();
    }
  };

  /**
   * Asks whether the server is back, once, and arranges to ask again if it is not.
   */
  function keepAsking(): void {
    stopAsking();

    asking = setTimeout(() => {
      const server = needs.where();

      if (server === '') {
        keepAsking();

        return;
      }

      void needs
        .fetching(new URL('/api/health', server).toString(), { method: 'GET' })
        .then(() => {
          settle(true);
        })
        .catch(() => {
          keepAsking();
        });
    }, needs.every);

    asking.unref();
  }

  return {
    isReachable: () => isReachable,
    noteReached: () => {
      settle(true);
    },
    noteMissed: () => {
      settle(false);
    },
    whenChanged: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    stop: stopAsking,
  };
};

export type { ServerReach, WhatReachNeeds };

export { theServerReach };
