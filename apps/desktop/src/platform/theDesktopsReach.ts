import type { Reachability } from '@ValenceClient/platform/Platform.types';

/**
 * Whether Valence is answering, according to the process that does the asking.
 *
 * Every request this client makes passes through its main process on the way to the server, so that
 * process sees a connection that could not be made as exactly that — rather than as a query which
 * failed for one of the dozen reasons a query fails. It is also the only thing still asking once the
 * application has gone quiet, which is what lets a laptop notice the server is back.
 *
 * What is known at the moment the page loads comes across with the page, because the first thing the
 * application does is decide which of itself to draw, and there is no sensible shape to draw around
 * a promise.
 *
 * @returns What this client can say about the server.
 */
const theDesktopsReach = (): Reachability => {
  const { reach } = window.valence;

  let isReachable = reach.now;

  reach.whenChanged((nowReachable) => {
    isReachable = nowReachable;
  });

  return {
    isReachable: () => isReachable,
    whenChanged: (listener) => reach.whenChanged(listener),
  };
};

export { theDesktopsReach };
