import { describe, expect, it } from 'vitest';
import { createRealtimeHandler } from './createRealtimeHandler';
import { createRealtimeRegistry } from './createRealtimeRegistry';
import { createEntitlements } from './createEntitlements';
import { FromServerSchema } from '@ValenceContracts/schemas/Realtime';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { PresenceBinding, PresenceControl } from './createRealtimeHandler';
import type { Schedule } from './createCoalescer';
import type { FromServer } from '@ValenceContracts/schemas/Realtime';
import type { Permission } from '@ValenceContracts/schemas/Permission';
import { createPartyRegistry } from '@ValenceServer/parties/createPartyRegistry';

const createWorld = (granted: Permission[] = []) => {
  const due: (() => void)[] = [];

  const schedule: Schedule = (run) => {
    due.push(run);

    return () => {
      const at = due.indexOf(run);

      if (at >= 0) {
        due.splice(at, 1);
      }
    };
  };

  const registry = createRealtimeRegistry({
    entitlements: createEntitlements({
      resolve: () => Promise.resolve(new Set(granted)),
      now: () => 0,
      ttlMs: 0,
    }),
    now: () => 1000,
    schedule,
    windowMs: 50,
  });

  const presenceCalls: { connected: string[]; disconnected: string[]; labels: string[] } = {
    connected: [],
    disconnected: [],
    labels: [],
  };

  let announce: ((event: PresenceControl) => void) | null = null;

  const presence: PresenceBinding = {
    connect: ({ clientId, deviceLabel, send }) => {
      presenceCalls.connected.push(clientId);
      presenceCalls.labels.push(deviceLabel);
      announce = send;

      return true;
    },
    disconnect: (clientId) => {
      presenceCalls.disconnected.push(clientId);
    },
    nameOf: () => Promise.resolve('Sam'),
  };

  let count = 0;
  const handler = createRealtimeHandler({
    registry,
    now: () => 1000,
    presence,
    newId: () => {
      count += 1;

      return `connection-${count.toString()}`;
    },
  });

  const sent: string[] = [];
  const socket = { send: (raw: string) => sent.push(raw) };

  const read = (): FromServer[] =>
    sent.map((raw) => FromServerSchema.parse(JsonValueSchema.parse(JSON.parse(raw))));

  return {
    registry,
    handler,
    socket,
    sent,
    read,
    presenceCalls,
    announce: (event: PresenceControl) => announce?.(event),
    tick: () => {
      for (const run of due.splice(0, due.length)) {
        run();
      }
    },
  };
};

describe('createRealtimeHandler', () => {
  it('registers the connection and greets it', () => {
    const world = createWorld();

    world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    expect(world.registry.count()).toBe(1);
    expect(world.read()[0]?.kind).toBe('welcome');
  });

  it('subscribes to what a client asks for', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['media'] }));

    expect(world.registry.topicsOf(session.id)).toStrictEqual(['media']);
  });

  it('tells a client plainly which topics it will never receive', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['media', 'logs'] }));

    const answer = world.read().find((message) => message.kind === 'subscribed');

    expect(answer?.kind === 'subscribed' ? answer.refused : []).toStrictEqual(['logs']);
  });

  it('ignores a message that is not JSON at all, and stays open', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive('not json {{{');

    expect(world.registry.count()).toBe(1);
  });

  it('ignores a message of a kind it does not know rather than closing the feed', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'from-a-newer-build', topics: ['media'] }));
    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['media'] }));

    expect(world.registry.topicsOf(session.id)).toStrictEqual(['media']);
  });

  it('ignores a subscribe naming a topic that does not exist', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['everything'] }));

    expect(world.registry.topicsOf(session.id)).toStrictEqual([]);
  });

  it('withdraws a subscription on request', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['media'] }));
    await session.receive(JSON.stringify({ kind: 'unsubscribe', topics: ['media'] }));

    expect(world.registry.topicsOf(session.id)).toStrictEqual([]);
  });

  it('follows a profile switch, so events go to who the tab is acting as now', async () => {
    const world = createWorld();
    const session = world.handler.open(
      { accountId: 'me', profileId: '11111111-1111-4111-8111-111111111111' },
      world.socket,
    );

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['profile'] }));
    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: '22222222-2222-4222-8222-222222222222' }),
    );

    world.registry.publish(
      'profile',
      { name: 'Sam' },
      { kind: 'profiles', profileIds: ['22222222-2222-4222-8222-222222222222'] },
    );
    world.tick();
    await world.registry.drain();

    expect(world.read().filter((message) => message.kind === 'event')).toHaveLength(1);
  });

  it('deregisters the connection when the socket closes', () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    session.close();

    expect(world.registry.count()).toBe(0);
  });

  it('keeps two tabs apart rather than giving them one connection', () => {
    const world = createWorld();

    const first = world.handler.open({ accountId: 'me', profileId: null }, world.socket);
    const second = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    expect(first.id).not.toBe(second.id);
    expect(world.registry.count()).toBe(2);
  });

  it('sends a ping so a dead socket can be noticed', () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    session.ping();

    expect(world.read().some((message) => message.kind === 'ping')).toBe(true);
  });

  it('registers the tab as present once it says which client it is', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );

    expect(world.presenceCalls.connected).toStrictEqual(['tab-one']);
  });

  it('does not register a tab that never said which client it is', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'identify', profileId: null }));

    expect(world.presenceCalls.connected).toStrictEqual([]);
  });

  it('registers a tab once, not again on every profile switch', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );
    await session.receive(
      JSON.stringify({
        kind: 'identify',
        profileId: '11111111-1111-4111-8111-111111111111',
        clientId: 'tab-one',
      }),
    );

    expect(world.presenceCalls.connected).toStrictEqual(['tab-one']);
  });

  it('takes the device label the tab gave', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({
        kind: 'identify',
        profileId: null,
        clientId: 'tab-one',
        deviceLabel: 'Living room',
      }),
    );

    expect(world.presenceCalls.labels).toStrictEqual(['Living room']);
  });

  it('marks the tab as gone when the socket closes, without a separate stream to watch', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );
    session.close();

    expect(world.presenceCalls.disconnected).toStrictEqual(['tab-one']);
  });

  it('carries a stop from an administrator down to that tab', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );
    world.announce({ kind: 'stopped', reason: 'This stream was stopped by an admin.' });

    const event = world.read().find((message) => message.kind === 'event');

    expect(event?.kind === 'event' ? event.payload : null).toStrictEqual({
      kind: 'stopped',
      reason: 'This stream was stopped by an admin.',
    });
  });

  it('carries a note somebody sent to that tab, with what it said', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );
    world.announce({ kind: 'message', text: 'Tea is ready' });

    const event = world.read().find((message) => message.kind === 'event');

    expect(event?.kind === 'event' ? event.payload : null).toStrictEqual({
      kind: 'message',
      text: 'Tea is ready',
    });
  });

  it('carries a resume, which has no reason to give', async () => {
    const world = createWorld();
    const session = world.handler.open({ accountId: 'me', profileId: null }, world.socket);

    await session.receive(
      JSON.stringify({ kind: 'identify', profileId: null, clientId: 'tab-one' }),
    );
    world.announce({ kind: 'resumed' });

    const event = world.read().find((message) => message.kind === 'event');

    expect(event?.kind === 'event' ? event.payload : null).toStrictEqual({ kind: 'resumed' });
  });

  it('lets an entitled connection take the admin feed', async () => {
    const world = createWorld(['server.logs']);
    const session = world.handler.open({ accountId: 'admin', profileId: null }, world.socket);

    await session.receive(JSON.stringify({ kind: 'subscribe', topics: ['logs'] }));

    expect(world.registry.topicsOf(session.id)).toStrictEqual(['logs']);
  });
});

describe('a connection that is part of a watch party', () => {
  const withAParty = () => {
    const registry = createRealtimeRegistry({
      entitlements: createEntitlements({
        resolve: () => Promise.resolve(new Set<Permission>()),
        now: () => 0,
        ttlMs: 0,
      }),
      now: () => 1000,
      schedule: (run) => {
        run();

        return () => {};
      },
      windowMs: 50,
    });

    const parties = createPartyRegistry(() => 'party-1');
    const told: string[][] = [];

    const handler = createRealtimeHandler({
      registry,
      now: () => 1000,
      presence: {
        connect: () => true,
        disconnect: () => {},
        nameOf: () => Promise.resolve('Sam'),
      },
      newId: () => 'connection-1',
      party: {
        registry: parties,
        tell: (connectionIds) => told.push([...connectionIds]),
      },
    });

    const sent: string[] = [];

    return {
      parties,
      told,
      session: handler.open(
        { accountId: 'me', profileId: null },
        { send: (raw) => sent.push(raw) },
      ),
      read: (): FromServer[] =>
        sent.map((raw) => FromServerSchema.parse(JsonValueSchema.parse(JSON.parse(raw)))),
    };
  };

  it('answers a clock question with the time here, so a party can agree on one', async () => {
    const world = withAParty();

    await world.session.receive(JSON.stringify({ kind: 'clockAsk', sentAtMs: 40 }));

    expect(world.read().map((one) => one.kind)).toContain('clockTell');
  });

  it('carries the moment the asker sent, so they can measure the round trip', async () => {
    const world = withAParty();

    await world.session.receive(JSON.stringify({ kind: 'clockAsk', sentAtMs: 40 }));

    const told = world.read().find((one) => one.kind === 'clockTell');

    expect(told).toMatchObject({ sentAtMs: 40, serverAtMs: 1000 });
  });

  it('opens a party when asked to, under the name the presence service gives', async () => {
    const world = withAParty();

    await world.session.receive(JSON.stringify({ kind: 'partyOpen', mediaId: 'a-film' }));

    expect(world.parties.count()).toBe(1);
  });

  it('takes somebody out of their party when the connection closes', async () => {
    const world = withAParty();

    await world.session.receive(JSON.stringify({ kind: 'partyOpen', mediaId: 'a-film' }));

    expect(world.parties.count()).toBe(1);

    world.session.close();

    expect(world.parties.count()).toBe(0);
  });

  it('ignores a message of a kind it does not know', async () => {
    const world = withAParty();

    await world.session.receive(JSON.stringify({ kind: 'somethingElse' }));

    expect(world.read().filter((one) => one.kind !== 'welcome')).toEqual([]);
  });
});

describe('naming somebody in a party', () => {
  it('asks who they are once rather than on every message they send', async () => {
    const asked: string[] = [];
    const registry = createRealtimeRegistry({
      entitlements: createEntitlements({
        resolve: () => Promise.resolve(new Set<Permission>()),
        now: () => 0,
        ttlMs: 0,
      }),
      now: () => 1000,
      schedule: (run) => {
        run();

        return () => {};
      },
      windowMs: 50,
    });

    const parties = createPartyRegistry(() => 'party-1');

    const handler = createRealtimeHandler({
      registry,
      now: () => 1000,
      presence: {
        connect: () => true,
        disconnect: () => {},
        nameOf: (accountId) => {
          asked.push(accountId);

          return Promise.resolve('Sam');
        },
      },
      newId: () => 'connection-1',
      party: { registry: parties, tell: () => {} },
    });

    const session = handler.open({ accountId: 'me', profileId: null }, { send: () => {} });

    await session.receive(JSON.stringify({ kind: 'partyOpen', mediaId: 'a-film' }));
    await session.receive(JSON.stringify({ kind: 'partyLoosen', everyoneMaySeek: true }));

    expect(asked).toEqual(['me']);
  });
});
