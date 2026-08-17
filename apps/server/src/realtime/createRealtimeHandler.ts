import { FromClientSchema } from '@FluxContracts/schemas/Realtime';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { FromServer } from '@FluxContracts/schemas/Realtime';
import type { RealtimeRegistry } from './createRealtimeRegistry';

type RealtimeSocket = {
  send: (raw: string) => void;
};

type Who = {
  accountId: string;
  profileId: string | null;
};

type RealtimeSession = {
  id: string;
  receive: (raw: string) => Promise<void>;
  ping: () => void;
  close: () => void;
};

type PresenceControl =
  { kind: 'stopped'; reason: string } | { kind: 'paused'; reason: string } | { kind: 'resumed' };

type PresenceBinding = {
  connect: (
    clientId: string,
    profileId: string | null,
    profileName: string | null,
    deviceLabel: string,
    send: (event: PresenceControl) => void,
  ) => void;
  disconnect: (clientId: string) => void;
  nameOf: (accountId: string, profileId: string | null) => Promise<string | null>;
};

type HandlerOptions = {
  registry: RealtimeRegistry;
  newId: () => string;
  now: () => number;
  presence?: PresenceBinding;
};

type RealtimeHandler = {
  open: (who: Who, socket: RealtimeSocket) => RealtimeSession;
};

const readMessage = (raw: string) => {
  try {
    return FromClientSchema.safeParse(JsonValueSchema.parse(JSON.parse(raw)));
  } catch {
    return { success: false } as const;
  }
};

/**
 * Turns a socket into a registered connection and answers what a client sends over it.
 *
 * Everything arriving from a client is parsed before it is believed, and anything unreadable is
 * dropped rather than closing the connection — a tab on an older build sending a message this server
 * does not know should lose that one message, not its whole feed.
 *
 * The socket itself is reduced to sending a string, so the parts worth testing can be tested without
 * one.
 *
 * A tab that says which client it is becomes that tab's presence connection, so the thing the server
 * watches for a tab going away is the socket itself rather than a second stream that has to be kept
 * in step with it.
 *
 * @param registry - Where connections and subscriptions are held.
 * @param newId - How a connection identifier is minted.
 * @param now - The clock, for stamping what is sent.
 * @param presence - How a tab is registered as present, where presence is being tracked.
 * @returns The handler.
 */
const createRealtimeHandler = ({
  registry,
  newId,
  now,
  presence,
}: HandlerOptions): RealtimeHandler => ({
  open: (who, socket) => {
    const id = newId();
    let claimed: string | null = null;

    const write = (message: FromServer) => {
      socket.send(JSON.stringify(message));
    };

    registry.open({
      id,
      accountId: who.accountId,
      profileId: who.profileId,
      deliver: write,
    });

    write({ kind: 'welcome', connectionId: id, topics: [] });

    return {
      id,

      receive: async (raw) => {
        const read = readMessage(raw);

        if (!read.success) {
          return;
        }

        if (read.data.kind === 'subscribe') {
          await registry.subscribe(id, read.data.topics);

          return;
        }

        if (read.data.kind === 'unsubscribe') {
          registry.unsubscribe(id, read.data.topics);

          return;
        }

        if (read.data.kind !== 'identify') {
          return;
        }

        registry.identify(id, read.data.profileId);

        const { clientId, deviceLabel, profileId } = read.data;

        if (presence === undefined || clientId === undefined || claimed === clientId) {
          return;
        }

        claimed = clientId;

        presence.connect(
          clientId,
          profileId,
          await presence.nameOf(who.accountId, profileId),
          deviceLabel ?? 'Unknown device',
          (event) => {
            write({
              kind: 'event',
              topic: 'presence',
              atMs: now(),
              folded: 0,
              payload:
                event.kind === 'resumed'
                  ? { kind: 'resumed' }
                  : { kind: event.kind, reason: event.reason },
            });
          },
        );
      },

      ping: () => {
        write({ kind: 'ping' });
      },

      close: () => {
        if (claimed !== null) {
          presence?.disconnect(claimed);
        }

        registry.close(id);
      },
    };
  },
});

export type { RealtimeHandler, RealtimeSession, RealtimeSocket, PresenceBinding, PresenceControl };

export { createRealtimeHandler };
