import { useCallback, useEffect, useState } from 'react';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import { chooseOffline, chosenOffline } from '@ValenceClient/offline/chosenOffline';

type OfflineMode = {
  isOffline: boolean;
  isByChoice: boolean;
  canGoOffline: boolean;
  isReachable: boolean;
  goOffline: (isChosen: boolean) => void;
};

/**
 * Whether the application should be its small self, and why.
 *
 * Offline is a mode rather than a run of failed requests. A client that has lost its server cannot
 * honestly draw a library, a search or an account page — none of those exist on this machine — and a
 * screen that half-works is a worse thing to be handed than one that is not offered. So the shape of
 * the application changes: what is on this disk, and the player.
 *
 * Two ways in and they mean the same thing. The server stopping answering is noticed by the host,
 * which is the only thing that sees every request; asking for it deliberately is the case that
 * matters more, because somebody about to fly wants to know now whether what they meant to take is
 * really here.
 *
 * Only where files can be kept. A browser with no network has nothing to fall back to, so putting it
 * into a mode built around a shelf of downloads would be showing it an empty room and calling it a
 * feature. It draws its ordinary errors instead, which is the honest thing to draw.
 *
 * Reach is read again after subscribing, not only before. Between the first read and the listener
 * being attached there is a gap, and a host that publishes only on a change publishes into it once
 * and never again — which left a window offline against a server that had been answering for hours.
 *
 * @returns What mode this is, and how to change it.
 */
const useOfflineMode = (): OfflineMode => {
  const platform = platformInUse();
  const canGoOffline = platform.canKeepFiles();

  const [isReachable, setIsReachable] = useState(() => platform.reachability.isReachable());
  const [isByChoice, setIsByChoice] = useState(chosenOffline);

  useEffect(() => {
    const stop = platform.reachability.whenChanged(setIsReachable);

    setIsReachable(platform.reachability.isReachable());

    return stop;
  }, [platform]);

  const goOffline = useCallback((isChosen: boolean) => {
    chooseOffline(isChosen);
    setIsByChoice(isChosen);
  }, []);

  return {
    isOffline: canGoOffline && (isByChoice || !isReachable),
    isByChoice,
    canGoOffline,
    isReachable,
    goOffline,
  };
};

export type { OfflineMode };

export { useOfflineMode };
