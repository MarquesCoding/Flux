import { describe, expect, it, vi } from 'vitest';
import { createPartyClient } from './createPartyClient';
import type { WatchParty } from '@FluxContracts/schemas/WatchParty';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';
import type { RealtimeEvent } from '@FluxContracts/schemas/Realtime';

const NOW_MS = 1_700_000_000_000;

const party: WatchParty = {
  id: 'party-1',
  mediaId: 'a-film',
  createdAtMs: NOW_MS,
  everyoneMaySeek: true,
  everyoneMayPlayPause: true,
  hasPassword: false,
  timekeeperId: 'dan',
  members: [
    {
      connectionId: 'dan',
      accountId: 'account-dan',
      profileId: null,
      name: 'Dan',
      role: 'host',
      joinedAtMs: NOW_MS,
      isWatching: true,
      positionSeconds: 100,
      reportedAtMs: NOW_MS,
      bufferedAheadSeconds: 10,
    },
  ],
};

const createWorld = () => {
  const sent: { kind: string }[] = [];
  const asked: number[] = [];
  const waits: { run: () => void; afterMs: number }[] = [];
  let heard: ((event: RealtimeEvent) => void) | null = null;
  let told: ((sentAtMs: number, serverAtMs: number) => void) | null = null;
  let isSubscribed = false;
  let clock = NOW_MS;

  const client: RealtimeClient = {
    start: () => {},
    stop: () => {},
    subscribe: (topic, listen) => {
      if (topic === 'party') {
        heard = listen;
        isSubscribed = true;
      }

      return () => {
        isSubscribed = false;
      };
    },
    identify: () => {},
    onResumed: () => () => {},
    isLive: () => true,
    connectionId: () => 'sam',
    sendParty: (message) => {
      sent.push(message);
    },
    askClock: (sentAtMs) => {
      asked.push(sentAtMs);
    },
    onClockTell: (heardIt) => {
      told = heardIt;

      return () => {
        told = null;
      };
    },
    onRefused: () => () => {},
    onNeedsPassword: () => () => {},
  };

  const watcher = { onParty: vi.fn(), onCommand: vi.fn(), onNotice: vi.fn() };

  const held = createPartyClient({
    client,
    watcher,
    schedule: (run, afterMs) => {
      waits.push({ run, afterMs });

      return () => {};
    },
    everyMs: 5000,
    now: () => clock,
  });

  return {
    held,
    watcher,
    sent,
    asked,
    waits,
    isSubscribed: () => isSubscribed,
    isListeningToTheClock: () => told !== null,
    moveClockTo: (next: number) => {
      clock = next;
    },
    answerTheClock: (serverAtMs: number) => {
      told?.(asked[asked.length - 1] ?? 0, serverAtMs);
    },
    tell: (payload: RealtimeEvent['payload']) => {
      heard?.({ kind: 'event', topic: 'party', atMs: NOW_MS, folded: 0, payload });
    },
  };
};

describe('createPartyClient', () => {
  it('listens to the party feed on the socket the app already has', () => {
    expect(createWorld().isSubscribed()).toBe(true);
  });

  it('passes on the party the server describes', () => {
    const world = createWorld();

    world.tell({ party });

    expect(world.watcher.onParty).toHaveBeenCalledWith(party);
  });

  it('passes on a command that came with it', () => {
    const world = createWorld();

    world.tell({
      party,
      command: {
        sequence: 4,
        atMs: NOW_MS,
        byName: 'Dan',
        byConnectionId: 'dan',
        command: { kind: 'pause', atSeconds: 12 },
      },
    });

    expect(world.watcher.onCommand).toHaveBeenCalledWith(expect.objectContaining({ sequence: 4 }));
  });

  it('says nothing happened where no command came with the party', () => {
    const world = createWorld();

    world.tell({ party });

    expect(world.watcher.onCommand).not.toHaveBeenCalled();
  });

  it('drops a party event it cannot read rather than passing on half of one', () => {
    const world = createWorld();

    world.tell({ party: { id: 'party-1' } });

    expect(world.watcher.onParty).not.toHaveBeenCalled();
  });

  it('asks the server for a party rather than deciding it has one', () => {
    const world = createWorld();

    world.held.open('a-film');
    world.held.join('party-2');
    world.held.leave();
    world.held.send({ kind: 'pause', atSeconds: 3 });
    world.held.setRole('sam', 'coHost');
    world.held.loosen({ everyoneMaySeek: false });

    expect(world.sent.map((message) => message.kind)).toEqual([
      'partyOpen',
      'partyJoin',
      'partyLeave',
      'partyCommand',
      'partySetRole',
      'partyLoosen',
    ]);
  });

  it('measures the clock rather than assuming two machines agree', () => {
    const world = createWorld();

    world.held.watchClock();
    world.moveClockTo(NOW_MS + 100);
    world.answerTheClock(NOW_MS + 4050);

    expect(world.held.offsetMs()).toBeCloseTo(4000, -1);
  });

  it('keeps measuring, since a clock that was right once will not stay right', () => {
    const world = createWorld();

    world.held.watchClock();

    expect(world.waits[0]?.afterMs).toBe(5000);

    world.waits[0]?.run();

    expect(world.asked).toHaveLength(2);
  });

  it('ignores an answer to a question it did not ask', () => {
    const world = createWorld();

    world.held.watchClock();
    world.answerTheClock(NOW_MS + 4000);
    world.answerTheClock(NOW_MS + 90_000);

    expect(world.held.offsetMs()).toBeCloseTo(4000, -1);
  });

  it('lets go of the feed and the clock when it stops', () => {
    const world = createWorld();

    world.held.watchClock();
    world.held.stop();

    expect(world.isSubscribed()).toBe(false);
    expect(world.isListeningToTheClock()).toBe(false);
  });
});
