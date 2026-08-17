import { describe, expect, it } from 'vitest';
import { createRealtimeRegistry } from './createRealtimeRegistry';
import { createEntitlements } from './createEntitlements';
import type { RealtimeConnection } from './createRealtimeRegistry';
import type { Schedule } from './createCoalescer';
import type { Permission } from '@FluxContracts/schemas/Permission';
import type { FromServer } from '@FluxContracts/schemas/Realtime';

const createClock = () => {
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

  return {
    schedule,
    tick: () => {
      for (const run of due.splice(0, due.length)) {
        run();
      }
    },
  };
};

const createTab = (id: string, accountId: string, profileId: string | null = null) => {
  const heard: FromServer[] = [];

  const connection: RealtimeConnection = {
    id,
    accountId,
    profileId,
    deliver: (message) => heard.push(message),
  };

  return {
    connection,
    heard,
    events: () => heard.filter((message) => message.kind === 'event'),
    dropped: () => heard.filter((message) => message.kind === 'dropped'),
  };
};

const createWorld = (granted: Map<string, Permission[]>) => {
  const clock = createClock();

  const entitlements = createEntitlements({
    resolve: (accountId) => Promise.resolve(new Set(granted.get(accountId) ?? [])),
    now: () => 0,
    ttlMs: 0,
  });

  const registry = createRealtimeRegistry({
    entitlements,
    now: () => 1000,
    schedule: clock.schedule,
    windowMs: 50,
  });

  return { clock, registry, granted };
};

describe('createRealtimeRegistry', () => {
  it('delivers a viewer topic to a signed-in tab holding no permissions', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media']);
    world.registry.publish('media', { added: 3 }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toHaveLength(1);
  });

  it('refuses an admin topic at subscription and never sends it', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    const split = await world.registry.subscribe('tab', ['media', 'logs']);

    world.registry.publish('logs', { line: 'secret' }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(split.refused).toStrictEqual(['logs']);
    expect(tab.events()).toStrictEqual([]);
  });

  it('carries both feeds on one connection where the permission is held', async () => {
    const world = createWorld(new Map([['admin', ['server.logs']]]));
    const tab = createTab('tab', 'admin');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media', 'logs']);
    world.registry.publish('media', { added: 1 }, { kind: 'everyone' });
    world.registry.publish('logs', { line: 'a' }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(
      tab
        .events()
        .map((message) => message.topic)
        .sort(),
    ).toStrictEqual(['logs', 'media']);
  });

  it('stops delivering an admin topic the moment the permission is taken away', async () => {
    const granted = new Map<string, Permission[]>([['admin', ['server.logs']]]);
    const world = createWorld(granted);
    const tab = createTab('tab', 'admin');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['logs']);

    granted.set('admin', []);

    world.registry.publish('logs', { line: 'after revocation' }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toStrictEqual([]);
    expect(tab.dropped()).toHaveLength(1);
  });

  it('drops a lost topic on a role change without waiting for the next event', async () => {
    const granted = new Map<string, Permission[]>([['admin', ['server.logs']]]);
    const world = createWorld(granted);
    const tab = createTab('tab', 'admin');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['logs']);

    granted.set('admin', []);
    await world.registry.recheck('admin');

    expect(world.registry.topicsOf('tab')).toStrictEqual([]);
    expect(tab.dropped()).toHaveLength(1);
  });

  it('leaves a topic alone on a role change that did not touch it', async () => {
    const world = createWorld(new Map([['admin', ['server.logs']]]));
    const tab = createTab('tab', 'admin');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media', 'logs']);
    await world.registry.recheck('admin');

    expect(world.registry.topicsOf('tab').sort()).toStrictEqual(['logs', 'media']);
    expect(tab.dropped()).toStrictEqual([]);
  });

  it('sends nothing to a tab that never asked for the topic', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['notifications']);
    world.registry.publish('media', { added: 1 }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toStrictEqual([]);
  });

  it('reaches only the accounts named', async () => {
    const world = createWorld(new Map());
    const mine = createTab('mine', 'me');
    const theirs = createTab('theirs', 'somebody else');

    world.registry.open(mine.connection);
    world.registry.open(theirs.connection);
    await world.registry.subscribe('mine', ['notifications']);
    await world.registry.subscribe('theirs', ['notifications']);
    world.registry.publish(
      'notifications',
      { unread: 1 },
      { kind: 'accounts', accountIds: ['me'] },
    );
    world.clock.tick();
    await world.registry.drain();

    expect(mine.events()).toHaveLength(1);
    expect(theirs.events()).toStrictEqual([]);
  });

  it('reaches only the profiles named, and never a tab acting as none', async () => {
    const world = createWorld(new Map());
    const chosen = createTab('chosen', 'me', 'profile-one');
    const other = createTab('other', 'me', 'profile-two');
    const none = createTab('none', 'me', null);

    for (const tab of [chosen, other, none]) {
      world.registry.open(tab.connection);
      await world.registry.subscribe(tab.connection.id, ['profile']);
    }

    world.registry.publish(
      'profile',
      { name: 'Sam' },
      { kind: 'profiles', profileIds: ['profile-one'] },
    );
    world.clock.tick();
    await world.registry.drain();

    expect(chosen.events()).toHaveLength(1);
    expect(other.events()).toStrictEqual([]);
    expect(none.events()).toStrictEqual([]);
  });

  it('follows a tab that switched profile rather than the one it opened with', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'me', 'profile-one');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['profile']);
    world.registry.identify('tab', 'profile-two');
    world.registry.publish(
      'profile',
      { name: 'Sam' },
      { kind: 'profiles', profileIds: ['profile-two'] },
    );
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toHaveLength(1);
  });

  it('delivers to every tab a person has open, not just one', async () => {
    const world = createWorld(new Map());
    const first = createTab('first', 'me');
    const second = createTab('second', 'me');

    world.registry.open(first.connection);
    world.registry.open(second.connection);
    await world.registry.subscribe('first', ['media']);
    await world.registry.subscribe('second', ['media']);
    world.registry.publish('media', { added: 1 }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(first.events()).toHaveLength(1);
    expect(second.events()).toHaveLength(1);
  });

  it('sends one event for a flood, saying how many it stood for', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media']);

    for (let index = 0; index < 4000; index += 1) {
      world.registry.publish('media', { added: index }, { kind: 'everyone' });
    }

    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toHaveLength(1);
    expect(tab.events()[0]?.folded).toBe(3999);
  });

  it('never folds an event for one account into an event for another', async () => {
    const world = createWorld(new Map());
    const mine = createTab('mine', 'me');
    const theirs = createTab('theirs', 'them');

    world.registry.open(mine.connection);
    world.registry.open(theirs.connection);
    await world.registry.subscribe('mine', ['notifications']);
    await world.registry.subscribe('theirs', ['notifications']);
    world.registry.publish(
      'notifications',
      { unread: 1 },
      { kind: 'accounts', accountIds: ['me'] },
    );
    world.registry.publish(
      'notifications',
      { unread: 9 },
      { kind: 'accounts', accountIds: ['them'] },
    );
    world.clock.tick();
    await world.registry.drain();

    expect(mine.events()[0]?.payload).toStrictEqual({ unread: 1 });
    expect(theirs.events()[0]?.payload).toStrictEqual({ unread: 9 });
  });

  it('sends nothing to a closed connection', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media']);
    world.registry.close('tab');
    world.registry.publish('media', { added: 1 }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toStrictEqual([]);
    expect(world.registry.count()).toBe(0);
  });

  it('forgets a connection whose socket has died rather than trying it forever', async () => {
    const world = createWorld(new Map());
    const heard: FromServer[] = [];

    world.registry.open({
      id: 'dead',
      accountId: 'viewer',
      profileId: null,
      deliver: (message) => {
        heard.push(message);

        throw new Error('socket is gone');
      },
    });

    await world.registry.subscribe('dead', ['media']);

    expect(world.registry.count()).toBe(0);
  });

  it('stops sending after a subscription is withdrawn', async () => {
    const world = createWorld(new Map());
    const tab = createTab('tab', 'viewer');

    world.registry.open(tab.connection);
    await world.registry.subscribe('tab', ['media']);
    world.registry.unsubscribe('tab', ['media']);
    world.registry.publish('media', { added: 1 }, { kind: 'everyone' });
    world.clock.tick();
    await world.registry.drain();

    expect(tab.events()).toStrictEqual([]);
  });

  it('refuses everything for a connection it does not know', async () => {
    const world = createWorld(new Map());

    const split = await world.registry.subscribe('never opened', ['media']);

    expect(split.allowed).toStrictEqual([]);
    expect(split.refused).toStrictEqual(['media']);
  });
});
