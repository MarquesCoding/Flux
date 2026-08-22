import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import { getRealtimeClient } from '@ValenceClient/realtime/getRealtimeClient';
import { readCurrentProfile } from '@ValenceClient/profiles/currentProfile';
import type { RealtimeClient } from '@ValenceClient/realtime/createRealtimeClient';
import { emitPresenceEvent } from './presenceEvents';

const PresenceEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stopped'), reason: z.string() }),
  z.object({ kind: z.literal('paused'), reason: z.string() }),
  z.object({ kind: z.literal('resumed') }),
  z.object({ kind: z.literal('message'), text: z.string().min(1) }),
]);

/**
 * Puts this tab in the administrator's list of open sessions, and carries an instruction to stop or
 * pause back to it.
 *
 * The socket is the presence connection rather than something kept alongside one, so a tab that has
 * gone is noticed by the same thing that noticed it arrive, and there is no second stream that can
 * drift out of step with it.
 *
 * @param client - The connection to watch over, which is the shared one unless a test says otherwise.
 * @returns The function that stops watching.
 */
const watchPresence = (client: RealtimeClient = getRealtimeClient()): (() => void) => {
  const release = client.subscribe('presence', (event) => {
    const parsed = PresenceEventSchema.safeParse(event.payload);

    if (parsed.success) {
      emitPresenceEvent(parsed.data);
    }
  });

  client.identify({
    profileId: readCurrentProfile(),
    clientId: platformInUse().thisClientId(),
    deviceLabel: platformInUse().describeThisClient(),
  });

  return release;
};

export { watchPresence };
