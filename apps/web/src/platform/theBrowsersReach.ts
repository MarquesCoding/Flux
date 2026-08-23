import type { Reachability } from '@ValenceClient/platform/Platform.types';

/**
 * Whether a browser thinks it can reach anything at all.
 *
 * What the browser knows is narrow and worth being honest about: `navigator.onLine` says whether
 * this machine has a network, not whether Valence is answering on it. A server that is off while
 * the wifi is fine reads as reachable here, and should — the request that follows will fail and say
 * so properly, which is a better error than a client deciding on its own that everything is down.
 *
 * A browser has nothing kept on disk to fall back to, so nothing here changes what is drawn. It
 * exists so the application can say "you appear to be offline" over a failure rather than drawing
 * the same unexplained error it draws for everything else.
 *
 * @returns What this browser can say about the network.
 */
const theBrowsersReach = (): Reachability => ({
  isReachable: () => navigator.onLine,
  whenChanged: (listener) => {
    const wentUp = () => {
      listener(true);
    };

    const wentDown = () => {
      listener(false);
    };

    window.addEventListener('online', wentUp);
    window.addEventListener('offline', wentDown);

    return () => {
      window.removeEventListener('online', wentUp);
      window.removeEventListener('offline', wentDown);
    };
  },
});

export { theBrowsersReach };
