import { FromServerSchema } from '@FluxContracts/schemas/Realtime';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { FromClient, RealtimeEvent, RealtimeTopic } from '@FluxContracts/schemas/Realtime';

type Handlers = {
  onOpen: () => void;
  onMessage: (raw: string) => void;
  onClose: () => void;
};

type RealtimeLink = {
  send: (raw: string) => void;
  close: () => void;
};

type Connect = (handlers: Handlers) => RealtimeLink;

type Listener = (event: RealtimeEvent) => void;

type RealtimeClientOptions = {
  connect: Connect;
  schedule: (run: () => void, afterMs: number) => () => void;
  backoffMs: (attempt: number) => number;
};

type Identity = {
  profileId?: string | null;
  clientId?: string;
  deviceLabel?: string;
};

type RealtimeClient = {
  start: () => void;
  stop: () => void;
  subscribe: (topic: RealtimeTopic, listen: Listener) => () => void;
  identify: (who: Identity) => void;
  onResumed: (run: () => void) => () => void;
  isLive: () => boolean;
};

const readMessage = (raw: string) => {
  try {
    return FromServerSchema.safeParse(JsonValueSchema.parse(JSON.parse(raw)));
  } catch {
    return { success: false } as const;
  }
};

/**
 * Owns the one socket the app has, and hands out per-topic subscriptions over it.
 *
 * Everything hard about a socket lives here so that nothing else has to think about it. A dropped
 * connection is retried with a growing wait and every live subscription is asked for again on the
 * way back up, because a feed that quietly stops after a laptop sleeps is worse than no feed at all
 * — nothing looks wrong.
 *
 * A tab that was away missed whatever happened while it was gone, so coming back announces itself
 * rather than pretending continuity. Callers listen for that and refetch, which is simpler and more
 * honest than replaying a gap of unknown size.
 *
 * @param connect - How a link is opened, injected so this can be tested without a socket.
 * @param schedule - How to wait before trying again.
 * @param backoffMs - How long to wait after a given number of failures.
 * @returns The client.
 */
const createRealtimeClient = ({
  connect,
  schedule,
  backoffMs,
}: RealtimeClientOptions): RealtimeClient => {
  const listeners = new Map<RealtimeTopic, Set<Listener>>();
  const resumed = new Set<() => void>();

  let link: RealtimeLink | null = null;
  let cancelRetry: (() => void) | null = null;
  let attempts = 0;
  let live = false;
  let wanted = false;
  let hasConnectedBefore = false;
  let actingAs: Identity | null = null;

  const identifyMessage = (who: Identity): FromClient => ({
    kind: 'identify',
    profileId: who.profileId ?? null,
    ...(who.clientId === undefined ? {} : { clientId: who.clientId }),
    ...(who.deviceLabel === undefined ? {} : { deviceLabel: who.deviceLabel }),
  });

  const send = (message: FromClient) => {
    link?.send(JSON.stringify(message));
  };

  const askForEverything = () => {
    const topics = [...listeners.keys()];

    if (topics.length > 0) {
      send({ kind: 'subscribe', topics });
    }
  };

  const deliver = (event: RealtimeEvent) => {
    for (const listen of listeners.get(event.topic) ?? []) {
      listen(event);
    }
  };

  const receive = (raw: string) => {
    const read = readMessage(raw);

    if (!read.success) {
      return;
    }

    if (read.data.kind === 'event') {
      deliver(read.data);

      return;
    }

    if (read.data.kind === 'ping') {
      send({ kind: 'pong' });

      return;
    }

    if (read.data.kind === 'dropped') {
      for (const topic of read.data.topics) {
        listeners.delete(topic);
      }
    }
  };

  const open = () => {
    link = connect({
      onOpen: () => {
        live = true;
        attempts = 0;

        if (actingAs !== null) {
          send(identifyMessage(actingAs));
        }

        askForEverything();

        if (hasConnectedBefore) {
          for (const run of resumed) {
            run();
          }
        }

        hasConnectedBefore = true;
      },

      onMessage: receive,

      onClose: () => {
        live = false;
        link = null;

        if (!wanted) {
          return;
        }

        cancelRetry = schedule(() => {
          cancelRetry = null;
          open();
        }, backoffMs(attempts));

        attempts += 1;
      },
    });
  };

  return {
    start: () => {
      if (wanted) {
        return;
      }

      wanted = true;
      open();
    },

    stop: () => {
      wanted = false;
      live = false;
      cancelRetry?.();
      cancelRetry = null;
      link?.close();
      link = null;
    },

    subscribe: (topic, listen) => {
      const already = listeners.get(topic) ?? new Set<Listener>();
      const isNewTopic = already.size === 0;

      already.add(listen);
      listeners.set(topic, already);

      if (live && isNewTopic) {
        send({ kind: 'subscribe', topics: [topic] });
      }

      return () => {
        const held = listeners.get(topic);

        held?.delete(listen);

        if (held !== undefined && held.size === 0) {
          listeners.delete(topic);

          if (live) {
            send({ kind: 'unsubscribe', topics: [topic] });
          }
        }
      };
    },

    identify: (who) => {
      actingAs = { ...actingAs, ...who };

      if (live) {
        send(identifyMessage(actingAs));
      }
    },

    onResumed: (run) => {
      resumed.add(run);

      return () => {
        resumed.delete(run);
      };
    },

    isLive: () => live,
  };
};

export type { RealtimeClient, RealtimeLink, Connect, Handlers, Identity };

export { createRealtimeClient };
