import { FromServerSchema } from '@ValenceContracts/schemas/Realtime';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { FromClient, RealtimeEvent, RealtimeTopic } from '@ValenceContracts/schemas/Realtime';

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

type PartyMessage = Extract<FromClient, { kind: `party${string}` }>;

type ClockHeard = (sentAtMs: number, serverAtMs: number) => void;

type RealtimeClient = {
  start: () => void;
  stop: () => void;
  subscribe: (topic: RealtimeTopic, listen: Listener) => () => void;
  identify: (who: Identity) => void;
  onResumed: (run: () => void) => () => void;
  isLive: () => boolean;
  connectionId: () => string | null;
  sendParty: (message: PartyMessage) => void;
  askClock: (sentAtMs: number) => void;
  onClockTell: (heard: ClockHeard) => () => void;
  onRefused: (heard: (why: string) => void) => () => void;
  onNeedsPassword: (heard: (partyId: string, wasWrong: boolean) => void) => () => void;
};

const MOST_WAITING = 16;

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
  const clockHeard = new Set<ClockHeard>();
  const refusals = new Set<(why: string) => void>();
  const challenges = new Set<(partyId: string, wasWrong: boolean) => void>();
  const waiting: PartyMessage[] = [];

  let link: RealtimeLink | null = null;
  let cancelRetry: (() => void) | null = null;
  let attempts = 0;
  let live = false;
  let wanted = false;
  let hasConnectedBefore = false;
  let actingAs: Identity | null = null;
  let myConnectionId: string | null = null;

  const identifyMessage = (who: Identity): FromClient => ({
    kind: 'identify',
    profileId: who.profileId ?? null,
    ...(who.clientId === undefined ? {} : { clientId: who.clientId }),
    ...(who.deviceLabel === undefined ? {} : { deviceLabel: who.deviceLabel }),
  });

  const send = (message: FromClient) => {
    if (!live) {
      return;
    }

    link?.send(JSON.stringify(message));
  };

  /**
   * Sends a party message, or holds it until there is a socket to send it on.
   *
   * Nothing else here needs holding: subscriptions and identity are asked for again on the way back
   * up, and a clock reading taken across an outage would be a lie rather than a measurement. Party
   * messages are the ones with no second chance — a tab opening an invitation asks to join before
   * the socket has finished connecting, and a join that is dropped leaves somebody looking at a
   * party they believe they are in and nobody else can see.
   *
   * @param message - What to send.
   */
  const sendParty = (message: PartyMessage) => {
    if (!live) {
      waiting.push(message);
      waiting.splice(0, Math.max(0, waiting.length - MOST_WAITING));

      return;
    }

    send(message);
  };

  const sendWhatWaited = () => {
    for (const message of waiting.splice(0, waiting.length)) {
      sendParty(message);
    }
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

    if (read.data.kind === 'welcome') {
      myConnectionId = read.data.connectionId;

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

    if (read.data.kind === 'clockTell') {
      for (const heard of clockHeard) {
        heard(read.data.sentAtMs, read.data.serverAtMs);
      }

      return;
    }

    if (read.data.kind === 'refused') {
      for (const heard of refusals) {
        heard(read.data.why);
      }

      return;
    }

    if (read.data.kind === 'partyNeedsPassword') {
      for (const heard of challenges) {
        heard(read.data.partyId, read.data.wasWrong);
      }

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
        sendWhatWaited();

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
      waiting.length = 0;
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

    connectionId: () => myConnectionId,

    sendParty,

    askClock: (sentAtMs) => {
      send({ kind: 'clockAsk', sentAtMs });
    },

    onClockTell: (heard) => {
      clockHeard.add(heard);

      return () => {
        clockHeard.delete(heard);
      };
    },

    onRefused: (heard) => {
      refusals.add(heard);

      return () => {
        refusals.delete(heard);
      };
    },

    onNeedsPassword: (heard) => {
      challenges.add(heard);

      return () => {
        challenges.delete(heard);
      };
    },
  };
};

export type { RealtimeClient, RealtimeLink, Connect, Handlers, Identity };

export { createRealtimeClient };
