import { z } from 'zod';
import { detectFromNavigator } from '@FluxWeb/playback/detectClientLabel';
import { readClientId } from './clientIdentity';
import { emitPresenceEvent } from './presenceEvents';
const PresenceEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stopped'), reason: z.string() }),
  z.object({ kind: z.literal('paused'), reason: z.string() }),
  z.object({ kind: z.literal('resumed') }),
]);

/**
 * Opens this tab's own presence connection.
 */
const watchPresence = (): (() => void) => {
  const params = new URLSearchParams({
    clientId: readClientId(),
    deviceLabel: detectFromNavigator(),
  });

  const source = new EventSource(`/api/presence/stream?${params.toString()}`, {
    withCredentials: true,
  });

  source.onmessage = (event: MessageEvent<string>) => {
    const parsed = PresenceEventSchema.safeParse(JSON.parse(event.data));

    if (parsed.success) {
      emitPresenceEvent(parsed.data);
    }
  };

  return () => {
    source.close();
  };
};

export { watchPresence };
