import { useEffect, useState } from 'react';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';

/**
 * What this device is holding, kept up to date as transfers move.
 *
 * Not a query, deliberately. Everything else a screen shows comes from the server through TanStack
 * Query, which caches, retries and refetches — all of which are the wrong behaviours for a fact
 * about this disk. The host knows when a transfer moves and says so, so this listens rather than
 * polls, and it goes on working when there is no server to retry against.
 *
 * @returns Everything on this device, in whatever order the host keeps it.
 */
const useHeldFiles = (): HeldFile[] => {
  const platform = platformInUse();
  const [held, setHeld] = useState<HeldFile[]>([]);

  useEffect(() => {
    let stillWatching = true;

    void platform.held.all().then((files) => {
      if (stillWatching) {
        setHeld(files);
      }
    });

    const stopListening = platform.held.whenChanged(setHeld);

    return () => {
      stillWatching = false;
      stopListening();
    };
  }, [platform]);

  return held;
};

export { useHeldFiles };
