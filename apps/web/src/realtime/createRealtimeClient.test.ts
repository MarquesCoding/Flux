import { describe, expect, it } from 'vitest';
import { createRealtimeClient } from './createRealtimeClient';
import { FromClientSchema } from '@FluxContracts/schemas/Realtime';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { Connect, Handlers } from './createRealtimeClient';
import type { FromClient, FromServer, RealtimeEvent } from '@FluxContracts/schemas/Realtime';

const createWorld = () => {
  const waits: { run: () => void; afterMs: number; cancelled: boolean }[] = [];
  const links: { sent: string[]; closed: boolean; handlers: Handlers }[] = [];

  const connect: Connect = (handlers) => {
    const link: { sent: string[]; closed: boolean; handlers: Handlers } = {
      sent: [],
      closed: false,
      handlers,
    };

    links.push(link);

    return {
      send: (raw) => link.sent.push(raw),
      close: () => {
        link.closed = true;
      },
    };
  };

  const client = createRealtimeClient({
    connect,
    schedule: (run, afterMs) => {
      const wait = { run, afterMs, cancelled: false };

      waits.push(wait);

      return () => {
        wait.cancelled = true;
      };
    },
    backoffMs: (attempt) => (attempt + 1) * 100,
  });

  const current = () => links[links.length - 1];

  const sentBy = (index: number): FromClient[] =>
    (links[index]?.sent ?? []).map((raw) =>
      FromClientSchema.parse(JsonValueSchema.parse(JSON.parse(raw))),
    );

  return {
    client,
    links,
    waits,
    current,
    sentBy,
    sent: () => sentBy(links.length - 1),
    deliver: (message: FromServer) => current()?.handlers.onMessage(JSON.stringify(message)),
    raw: (message: string) => current()?.handlers.onMessage(message),
    openIt: () => current()?.handlers.onOpen(),
    dropIt: () => current()?.handlers.onClose(),
    runWaits: () => {
      for (const wait of waits.splice(0, waits.length)) {
        if (!wait.cancelled) {
          wait.run();
        }
      }
    },
  };
};

const anEvent = (topic: RealtimeEvent['topic'], payload: number): FromServer => ({
  kind: 'event',
  topic,
  atMs: 1,
  folded: 0,
  payload: { at: payload },
});

describe('createRealtimeClient', () => {
  it('opens one connection when started, not one per subscription', () => {
    const world = createWorld();

    world.client.subscribe('media', () => {});
    world.client.subscribe('notifications', () => {});
    world.client.start();

    expect(world.links).toHaveLength(1);
  });

  it('asks for everything already wanted as soon as it is connected', () => {
    const world = createWorld();

    world.client.subscribe('media', () => {});
    world.client.subscribe('notifications', () => {});
    world.client.start();
    world.openIt();

    expect(world.sent()).toStrictEqual([{ kind: 'subscribe', topics: ['media', 'notifications'] }]);
  });

  it('asks for a topic taken up after connecting', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.client.subscribe('media', () => {});

    expect(world.sent()).toStrictEqual([{ kind: 'subscribe', topics: ['media'] }]);
  });

  it('does not ask twice for a topic two components both want', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.client.subscribe('media', () => {});
    world.client.subscribe('media', () => {});

    expect(world.sent()).toStrictEqual([{ kind: 'subscribe', topics: ['media'] }]);
  });

  it('gives an event to every listener of that topic', () => {
    const world = createWorld();
    const heard: number[] = [];

    world.client.subscribe('media', () => heard.push(1));
    world.client.subscribe('media', () => heard.push(2));
    world.client.start();
    world.openIt();
    world.deliver(anEvent('media', 5));

    expect(heard).toStrictEqual([1, 2]);
  });

  it('does not give a listener a topic it did not ask for', () => {
    const world = createWorld();
    const heard: string[] = [];

    world.client.subscribe('media', () => heard.push('media'));
    world.client.subscribe('notifications', () => heard.push('notifications'));
    world.client.start();
    world.openIt();
    world.deliver(anEvent('notifications', 1));

    expect(heard).toStrictEqual(['notifications']);
  });

  it('stops giving events to a listener that let go', () => {
    const world = createWorld();
    const heard: number[] = [];

    const release = world.client.subscribe('media', () => heard.push(1));

    world.client.start();
    world.openIt();
    release();
    world.deliver(anEvent('media', 1));

    expect(heard).toStrictEqual([]);
  });

  it('tells the server to stop sending a topic nothing wants any more', () => {
    const world = createWorld();

    const release = world.client.subscribe('media', () => {});

    world.client.start();
    world.openIt();
    release();

    expect(world.sent()).toContainEqual({ kind: 'unsubscribe', topics: ['media'] });
  });

  it('keeps sending a topic one of two listeners still wants', () => {
    const world = createWorld();

    const release = world.client.subscribe('media', () => {});

    world.client.subscribe('media', () => {});
    world.client.start();
    world.openIt();
    release();

    expect(world.sent()).not.toContainEqual({ kind: 'unsubscribe', topics: ['media'] });
  });

  it('reconnects after the connection drops', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.dropIt();
    world.runWaits();

    expect(world.links).toHaveLength(2);
  });

  it('waits longer after each failed attempt', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.dropIt();

    const first = world.waits[0]?.afterMs;

    world.runWaits();
    world.dropIt();

    expect(world.waits[0]?.afterMs).toBeGreaterThan(first ?? 0);
  });

  it('starts waiting from the beginning again after a connection that worked', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.dropIt();
    world.runWaits();
    world.openIt();
    world.dropIt();

    expect(world.waits[0]?.afterMs).toBe(100);
  });

  it('asks for its subscriptions again on the new connection', () => {
    const world = createWorld();

    world.client.subscribe('media', () => {});
    world.client.start();
    world.openIt();
    world.dropIt();
    world.runWaits();
    world.openIt();

    expect(world.sentBy(1)).toContainEqual({ kind: 'subscribe', topics: ['media'] });
  });

  it('delivers events over the connection it reconnected with', () => {
    const world = createWorld();
    const heard: number[] = [];

    world.client.subscribe('media', () => heard.push(1));
    world.client.start();
    world.openIt();
    world.dropIt();
    world.runWaits();
    world.openIt();
    world.deliver(anEvent('media', 1));

    expect(heard).toStrictEqual([1]);
  });

  it('says it has resumed so callers can refetch what they missed', () => {
    const world = createWorld();
    let resumed = 0;

    world.client.onResumed(() => {
      resumed += 1;
    });
    world.client.start();
    world.openIt();
    world.dropIt();
    world.runWaits();
    world.openIt();

    expect(resumed).toBe(1);
  });

  it('does not claim to have resumed on the very first connection', () => {
    const world = createWorld();
    let resumed = 0;

    world.client.onResumed(() => {
      resumed += 1;
    });
    world.client.start();
    world.openIt();

    expect(resumed).toBe(0);
  });

  it('does not reconnect once it has been stopped', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.client.stop();
    world.dropIt();
    world.runWaits();

    expect(world.links).toHaveLength(1);
  });

  it('cancels a reconnect already waiting when stopped', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.dropIt();
    world.client.stop();
    world.runWaits();

    expect(world.links).toHaveLength(1);
  });

  it('answers a ping so the server knows it is still there', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.deliver({ kind: 'ping' });

    expect(world.sent()).toContainEqual({ kind: 'pong' });
  });

  it('stops listening to a topic the server says it may not have', () => {
    const world = createWorld();
    const heard: number[] = [];

    world.client.subscribe('logs', () => heard.push(1));
    world.client.start();
    world.openIt();
    world.deliver({ kind: 'dropped', topics: ['logs'] });
    world.deliver(anEvent('logs', 1));

    expect(heard).toStrictEqual([]);
  });

  it('does not ask again for a topic it was told it may not have', () => {
    const world = createWorld();

    world.client.subscribe('logs', () => {});
    world.client.start();
    world.openIt();
    world.deliver({ kind: 'dropped', topics: ['logs'] });
    world.dropIt();
    world.runWaits();
    world.openIt();

    expect(world.sentBy(1)).toStrictEqual([]);
  });

  it('ignores a message that is not JSON without dropping the connection', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.raw('not json {{{');

    expect(world.client.isLive()).toBe(true);
  });

  it('ignores a message shaped in a way it does not understand', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.raw(JSON.stringify({ kind: 'from-a-newer-server' }));

    expect(world.client.isLive()).toBe(true);
  });

  it('tells the server which profile the tab is acting as', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.client.identify({ profileId: '11111111-1111-4111-8111-111111111111' });

    expect(world.sent()).toContainEqual({
      kind: 'identify',
      profileId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('says who it is acting as again after reconnecting, not who it opened as', () => {
    const world = createWorld();

    world.client.start();
    world.openIt();
    world.client.identify({ profileId: '22222222-2222-4222-8222-222222222222' });
    world.dropIt();
    world.runWaits();
    world.openIt();

    expect(world.sentBy(1)).toContainEqual({
      kind: 'identify',
      profileId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('reports whether it is connected', () => {
    const world = createWorld();

    expect(world.client.isLive()).toBe(false);

    world.client.start();
    world.openIt();

    expect(world.client.isLive()).toBe(true);

    world.dropIt();

    expect(world.client.isLive()).toBe(false);
  });

  it('opens only one connection however many times it is started', () => {
    const world = createWorld();

    world.client.start();
    world.client.start();

    expect(world.links).toHaveLength(1);
  });
});
