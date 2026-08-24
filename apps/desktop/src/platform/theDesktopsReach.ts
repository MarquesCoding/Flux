import type { Reachability } from '@ValenceClient/platform/Platform.types';

/**
 * Whether Valence is answering, according to the process that does the asking.
 *
 * Every request this client makes passes through its main process on the way to the server, so that
 * process sees a connection that could not be made as exactly that — rather than as a query which
 * failed for one of the dozen reasons a query fails. It is also the only thing still asking once the
 * application has gone quiet, which is what lets a laptop notice the server is back.
 *
 * Asked rather than remembered. What the main process knows is the truth, and a copy kept out here
 * is only as good as the last message that arrived: a change published before this window existed,
 * or before its listener was attached, reaches nobody and is never repeated, because the main
 * process only publishes on a change and has already changed. A window that started while the server
 * was down then stayed offline against a server that had been answering for hours. Reading the level
 * each time cannot miss an edge, because it does not depend on one.
 *
 * @returns What this client can say about the server.
 */
const theDesktopsReach = (): Reachability => {
  const { reach } = window.valence;

  return {
    isReachable: () => reach.now(),
    whenChanged: (listener) => reach.whenChanged(listener),
  };
};

export { theDesktopsReach };
