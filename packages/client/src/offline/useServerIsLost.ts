import { useEffect, useState } from 'react';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import { useOfflineMode } from '@ValenceClient/offline/useOfflineMode';

/**
 * Whether the server this client was told to watch has gone and left it with nothing to show.
 *
 * Offline mode is built around a shelf of downloads. Where the shelf is empty there is no smaller
 * application to be — only an empty room with a badge on it, saying nothing is on this device when
 * the useful question is where Valence went. A client that owns a screen of its own should ask that
 * question again rather than draw the room.
 *
 * Asked rather than sampled once. Reach starts out assumed, because a client that has not yet made a
 * request has no grounds to say the server is missing, and the first failed request is what says so
 * — which happens after the application has already been drawn. Reading it once on the way up
 * therefore always reads back an optimism that has not been tested yet, and the answer never
 * changed. This follows reach instead, and asks the disk again each time it moves.
 *
 * A disk that cannot be asked is treated as holding something. Somebody watching a film on an
 * aeroplane should not be thrown back to a form because one message did not come back.
 *
 * @returns Whether the honest thing to draw is the question of where Valence is.
 */
const useServerIsLost = (): boolean => {
  const platform = platformInUse();
  const { isReachable } = useOfflineMode();

  const [isHolding, setIsHolding] = useState<boolean | null>(null);

  useEffect(() => {
    let stillAsking = true;

    void platform.held
      .all()
      .then((files) => files.length > 0)
      .catch(() => true)
      .then((holding) => {
        if (stillAsking) {
          setIsHolding(holding);
        }
      });

    return () => {
      stillAsking = false;
    };
  }, [platform, isReachable]);

  return !isReachable && isHolding === false;
};

export { useServerIsLost };
