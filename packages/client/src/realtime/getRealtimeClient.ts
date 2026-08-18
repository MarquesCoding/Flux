import { createRealtimeClient } from './createRealtimeClient';
import { platformInUse } from '@FluxClient/platform/installPlatform';
import { realtimeBackoffMs } from './realtimeBackoffMs';
import type { RealtimeClient } from './createRealtimeClient';

let client: RealtimeClient | null = null;

/**
 * The one connection this tab has, made when something first wants it.
 *
 * Shared rather than made per caller because the whole point of moving off separate streams was to
 * stop a page holding several connections at once — a browser allows only a handful to one origin,
 * and an administrator with a player open was using most of them.
 *
 * @returns The client, started.
 */
const getRealtimeClient = (): RealtimeClient => {
  client ??= createRealtimeClient({
    connect: platformInUse().openSocket,
    schedule: (run, afterMs) => {
      const timer = setTimeout(run, afterMs);

      return () => {
        clearTimeout(timer);
      };
    },
    backoffMs: realtimeBackoffMs,
  });

  client.start();

  return client;
};

export { getRealtimeClient };
