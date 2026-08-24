import { FromClientSchema } from '@ValenceContracts/schemas/Realtime';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { FromServer } from '@ValenceContracts/schemas/Realtime';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { handlePartyMessage, tellEveryone } from '@ValenceServer/parties/handlePartyMessage';
import type { RealtimeRegistry } from './createRealtimeRegistry';
import type { PartyBinding } from '@ValenceServer/parties/handlePartyMessage';

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
  | { kind: 'stopped'; reason: string }
  | { kind: 'paused'; reason: string }
  | { kind: 'resumed' }
  | { kind: 'message'; text: string };

type PresenceBinding = {
  connect: (arrival: {
    clientId: string;
    accountId: string | null;
    profileId: string | null;
    profileName: string | null;
    deviceLabel: string;
    send: (event: PresenceControl) => void;
  }) => void;
  disconnect: (clientId: string) => void;
  nameOf: (accountId: string, profileId: string | null) => Promise<string | null>;
};

type HandlerOptions = {
  registry: RealtimeRegistry;
  newId: () => string;
  now: () => number;
  presence?: PresenceBinding;
  party?: PartyBinding;
};

type RealtimeHandler = {
  open: (who: Who, socket: RealtimeSocket) => RealtimeSession;
};

const asPayload = (event: PresenceControl): JsonValue => {
  if (event.kind === 'resumed') {
    return { kind: 'resumed' };
  }

  if (event.kind === 'message') {
    return { kind: 'message', text: event.text };
  }

  return { kind: event.kind, reason: event.reason };
};

const UNNAMED = 'Someone';

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
  party,
}: HandlerOptions): RealtimeHandler => ({
  open: (who, socket) => {
    const id = newId();
    let claimed: string | null = null;
    let myName: string | null = null;
    let chosenProfileId = who.profileId;

    const nameFor = async (): Promise<string> => {
      if (myName !== null) {
        return myName;
      }

      myName = (await presence?.nameOf(who.accountId, chosenProfileId)) ?? null;

      return myName ?? UNNAMED;
    };

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

        if (read.data.kind === 'clockAsk') {
          write({ kind: 'clockTell', sentAtMs: read.data.sentAtMs, serverAtMs: now() });

          return;
        }

        if (read.data.kind.startsWith('party')) {
          if (party !== undefined) {
            handlePartyMessage(
              read.data,
              {
                connectionId: id,
                accountId: who.accountId,
                profileId: chosenProfileId,
                name: await nameFor(),
              },
              write,
              party,
              now,
            );
          }

          return;
        }

        if (read.data.kind !== 'identify') {
          return;
        }

        registry.identify(id, read.data.profileId);

        const { clientId, deviceLabel, profileId } = read.data;

        if (profileId !== chosenProfileId) {
          chosenProfileId = profileId;
          myName = null;
        }

        if (presence === undefined || clientId === undefined || claimed === clientId) {
          return;
        }

        claimed = clientId;

        const named = await presence.nameOf(who.accountId, profileId);

        myName = named ?? myName;

        presence.connect({
          clientId,
          accountId: who.accountId,
          profileId,
          profileName: named,
          deviceLabel: deviceLabel ?? 'Unknown device',
          send: (event) => {
            write({
              kind: 'event',
              topic: 'presence',
              atMs: now(),
              folded: 0,
              payload: asPayload(event),
            });
          },
        });
      },

      ping: () => {
        write({ kind: 'ping' });
      },

      close: () => {
        if (claimed !== null) {
          presence?.disconnect(claimed);
        }

        if (party !== undefined) {
          tellEveryone(party, party.registry.leave(id));
        }

        registry.close(id);
      },
    };
  },
});

export type { RealtimeHandler, RealtimeSession, RealtimeSocket, PresenceBinding, PresenceControl };

export { createRealtimeHandler };
