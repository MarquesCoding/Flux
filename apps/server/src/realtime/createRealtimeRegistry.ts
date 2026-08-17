import { mayHearTopic, splitByEntitlement } from '@FluxContracts/schemas/Realtime';
import { createCoalescer } from './createCoalescer';
import type { Coalesced, Schedule } from './createCoalescer';
import type { Entitlements } from './createEntitlements';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { FromServer, RealtimeTopic } from '@FluxContracts/schemas/Realtime';

type RealtimeConnection = {
  id: string;
  accountId: string;
  profileId: string | null;
  deliver: (message: FromServer) => void;
};

type Reach =
  | { kind: 'everyone' }
  | { kind: 'accounts'; accountIds: readonly string[] }
  | { kind: 'profiles'; profileIds: readonly string[] }
  | { kind: 'connections'; connectionIds: readonly string[] };

type RegistryOptions = {
  entitlements: Entitlements;
  now: () => number;
  schedule: Schedule;
  windowMs: number;
};

type RealtimeRegistry = {
  open: (connection: RealtimeConnection) => void;
  close: (connectionId: string) => void;
  subscribe: (
    connectionId: string,
    topics: readonly RealtimeTopic[],
  ) => Promise<{ allowed: RealtimeTopic[]; refused: RealtimeTopic[] }>;
  unsubscribe: (connectionId: string, topics: readonly RealtimeTopic[]) => void;
  identify: (connectionId: string, profileId: string | null) => void;
  publish: (topic: RealtimeTopic, payload: JsonValue, reach: Reach) => void;
  recheck: (accountId: string) => Promise<void>;
  recheckAll: () => Promise<void>;
  topicsOf: (connectionId: string) => RealtimeTopic[];
  count: () => number;
  drain: () => Promise<void>;
  stop: () => void;
};

const keyFor = (topic: RealtimeTopic, reach: Reach): string => {
  if (reach.kind === 'everyone') {
    return `${topic}|everyone`;
  }

  const ids =
    reach.kind === 'accounts'
      ? reach.accountIds
      : reach.kind === 'profiles'
        ? reach.profileIds
        : reach.connectionIds;

  return `${topic}|${reach.kind}|${[...ids].sort().join(',')}`;
};

const withinReach = (connection: RealtimeConnection, reach: Reach): boolean => {
  if (reach.kind === 'everyone') {
    return true;
  }

  if (reach.kind === 'accounts') {
    return reach.accountIds.includes(connection.accountId);
  }

  if (reach.kind === 'connections') {
    return reach.connectionIds.includes(connection.id);
  }

  return connection.profileId !== null && reach.profileIds.includes(connection.profileId);
};

/**
 * Holds every open connection, what each has asked to hear, and who each is acting as, and delivers
 * published events to the connections entitled to them.
 *
 * Entitlement is checked twice on purpose. Once when a topic is asked for, so a client is told
 * plainly that it will never receive something rather than waiting on a feed that is silently never
 * sent; and again for every connection at the moment of delivery, because roles are editable while a
 * socket is held open. Only the second check protects anything — the first is a courtesy.
 *
 * A publisher never waits for a socket. Publishing gathers into a short window and returns, so a
 * scan changing four thousand items is neither slowed by a stalled client nor able to push four
 * thousand frames at one.
 *
 * @param entitlements - How permissions are read for an account.
 * @param now - The clock, injected so this can be tested without one.
 * @param schedule - How to wait out the gathering window.
 * @param windowMs - How long events gather before being sent.
 * @returns The registry.
 */
const createRealtimeRegistry = ({
  entitlements,
  now,
  schedule,
  windowMs,
}: RegistryOptions): RealtimeRegistry => {
  const connections = new Map<string, RealtimeConnection>();
  const subscriptions = new Map<string, Set<RealtimeTopic>>();
  const reaches = new Map<string, { topic: RealtimeTopic; reach: Reach }>();

  const sendTo = (connection: RealtimeConnection, message: FromServer) => {
    try {
      connection.deliver(message);
    } catch {
      connections.delete(connection.id);
      subscriptions.delete(connection.id);
    }
  };

  const fanOut = async (key: string, coalesced: Coalesced) => {
    const addressed = reaches.get(key);

    reaches.delete(key);

    if (addressed === undefined) {
      return;
    }

    const message: FromServer = {
      kind: 'event',
      topic: addressed.topic,
      atMs: now(),
      folded: coalesced.folded,
      payload: coalesced.payload,
    };

    for (const connection of Array.from(connections.values())) {
      if (!subscriptions.get(connection.id)?.has(addressed.topic)) {
        continue;
      }

      if (!withinReach(connection, addressed.reach)) {
        continue;
      }

      const held = await entitlements.of(connection.accountId);

      if (!mayHearTopic(addressed.topic, held)) {
        subscriptions.get(connection.id)?.delete(addressed.topic);
        sendTo(connection, { kind: 'dropped', topics: [addressed.topic] });

        continue;
      }

      sendTo(connection, message);
    }
  };

  const dropWhatIsNoLongerHeld = async (matches: (connection: RealtimeConnection) => boolean) => {
    for (const connection of Array.from(connections.values())) {
      const already = subscriptions.get(connection.id);

      if (!matches(connection) || already === undefined) {
        continue;
      }

      const held = await entitlements.of(connection.accountId);
      const lost = [...already].filter((topic) => !mayHearTopic(topic, held));

      if (lost.length === 0) {
        continue;
      }

      for (const topic of lost) {
        already.delete(topic);
      }

      sendTo(connection, { kind: 'dropped', topics: lost });
    }
  };

  const inFlight = new Set<Promise<void>>();

  const coalescer = createCoalescer({
    windowMs,
    schedule,
    flush: (key, coalesced) => {
      const sending = fanOut(key, coalesced).finally(() => {
        inFlight.delete(sending);
      });

      inFlight.add(sending);
    },
  });

  return {
    open: (connection) => {
      connections.set(connection.id, connection);
      subscriptions.set(connection.id, new Set());
    },

    close: (connectionId) => {
      connections.delete(connectionId);
      subscriptions.delete(connectionId);
    },

    subscribe: async (connectionId, topics) => {
      const connection = connections.get(connectionId);

      if (connection === undefined) {
        return { allowed: [], refused: [...topics] };
      }

      const held = await entitlements.of(connection.accountId);
      const split = splitByEntitlement(topics, held);
      const already = subscriptions.get(connectionId) ?? new Set<RealtimeTopic>();

      for (const topic of split.allowed) {
        already.add(topic);
      }

      subscriptions.set(connectionId, already);
      sendTo(connection, { kind: 'subscribed', topics: split.allowed, refused: split.refused });

      return split;
    },

    unsubscribe: (connectionId, topics) => {
      const already = subscriptions.get(connectionId);

      if (already === undefined) {
        return;
      }

      for (const topic of topics) {
        already.delete(topic);
      }
    },

    identify: (connectionId, profileId) => {
      const connection = connections.get(connectionId);

      if (connection !== undefined) {
        connections.set(connectionId, { ...connection, profileId });
      }
    },

    publish: (topic, payload, reach) => {
      const key = keyFor(topic, reach);

      reaches.set(key, { topic, reach });
      coalescer.offer(key, payload);
    },

    recheck: async (accountId) => {
      entitlements.forget(accountId);

      await dropWhatIsNoLongerHeld((connection) => connection.accountId === accountId);
    },

    recheckAll: async () => {
      entitlements.forgetAll();

      await dropWhatIsNoLongerHeld(() => true);
    },

    topicsOf: (connectionId) => [...(subscriptions.get(connectionId) ?? [])],

    count: () => connections.size,

    drain: async () => {
      while (inFlight.size > 0) {
        await Promise.all(inFlight);
      }
    },

    stop: () => {
      coalescer.stop();
      connections.clear();
      subscriptions.clear();
      reaches.clear();
    },
  };
};

export type { RealtimeRegistry, RealtimeConnection, Reach };

export { createRealtimeRegistry };
