import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchParty } from './useWatchParty';
import type {
  PartyMember,
  SequencedCommand,
  WatchParty,
} from '@ValenceContracts/schemas/WatchParty';
import type { RealtimeClient } from '@ValenceClient/realtime/createRealtimeClient';
import type { RealtimeEvent } from '@ValenceContracts/schemas/Realtime';

const NOW_MS = 1_700_000_000_000;

const member = (over?: Partial<PartyMember>): PartyMember => ({
  connectionId: 'dan',
  accountId: 'account-dan',
  profileId: null,
  name: 'Dan',
  role: 'host',
  joinedAtMs: NOW_MS,
  isWatching: true,
  isReady: true,
  positionSeconds: 100,
  reportedAtMs: NOW_MS,
  bufferedAheadSeconds: 10,
  ...over,
});

const party = (over?: Partial<WatchParty>): WatchParty => ({
  id: 'party-1',
  mediaId: 'a-film',
  createdAtMs: NOW_MS,
  everyoneMaySeek: true,
  everyoneMayPlayPause: true,
  hasPassword: false,
  isPlaying: true,
  isHeld: false,
  timekeeperId: 'dan',
  members: [member(), member({ connectionId: 'sam', name: 'Sam', role: 'guest' })],
  ...over,
});

const createWorld = (meConnectionId = 'sam') => {
  const sent: { kind: string; partyId?: string }[] = [];
  const resumed: (() => void)[] = [];
  let heard: ((event: RealtimeEvent) => void) | null = null;

  let challenged: ((partyId: string, wasWrong: boolean) => void) | null = null;

  const client: RealtimeClient = {
    start: () => {},
    stop: () => {},
    subscribe: (topic, listen) => {
      if (topic === 'party') {
        heard = listen;
      }

      return () => {
        heard = null;
      };
    },
    identify: () => {},
    onResumed: (run) => {
      resumed.push(run);

      return () => {};
    },
    isLive: () => true,
    connectionId: () => meConnectionId,
    sendParty: (message) => {
      sent.push(message);
    },
    askClock: () => {},
    onClockTell: () => () => {},
    onRefused: () => () => {},
    onNeedsPassword: (heard) => {
      challenged = heard;

      return () => {
        challenged = null;
      };
    },
  };

  return {
    client,
    sent,
    resume: () => {
      for (const run of resumed) {
        run();
      }
    },
    tell: (told: WatchParty) => {
      heard?.({ kind: 'event', topic: 'party', atMs: NOW_MS, folded: 0, payload: { party: told } });
    },
    challenge: (partyId: string, wasWrong: boolean) => {
      challenged?.(partyId, wasWrong);
    },
    tellRemoved: (byName: string) => {
      heard?.({
        kind: 'event',
        topic: 'party',
        atMs: NOW_MS,
        folded: 0,
        payload: {
          party: { ...party({ members: [] }), members: [] },
          notice: { kind: 'removed', byName },
        },
      });
    },
    tellWithCommand: (told: WatchParty, command: SequencedCommand) => {
      heard?.({
        kind: 'event',
        topic: 'party',
        atMs: NOW_MS,
        folded: 0,
        payload: { party: told, command },
      });
    },
    tellNonsense: () => {
      heard?.({ kind: 'event', topic: 'party', atMs: NOW_MS, folded: 0, payload: { party: 4 } });
    },
  };
};

describe('useWatchParty', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds whatever the server last said the party is', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    expect(result.current.party?.id).toBe('party-1');
  });

  it('reads the timekeeper as where they will be now, not where they were when they said so', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      vi.setSystemTime(NOW_MS + 800);
      world.tell(party());
    });

    expect(result.current.referenceSeconds).toBeCloseTo(100.8, 1);
  });

  it('has no reference of its own to follow when it is the one keeping time', () => {
    const world = createWorld('dan');
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    expect(result.current.referenceSeconds).toBeNull();
  });

  it('gets back into the party after a reconnection, since the old connection is gone', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    expect(result.current.party).not.toBeNull();

    act(() => {
      world.resume();
    });

    expect(world.sent).toContainEqual({ kind: 'partyJoin', partyId: 'party-1' });
  });

  it('does not rejoin a party it was never in', () => {
    const world = createWorld();

    renderHook(() => useWatchParty(world.client));

    act(() => {
      world.resume();
    });

    expect(world.sent).toEqual([]);
  });

  it('does not rejoin a party it chose to leave', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    act(() => {
      result.current.leave();
    });

    act(() => {
      world.resume();
    });

    expect(world.sent.filter((message) => message.kind === 'partyJoin')).toEqual([]);
  });

  it('forgets the party on leaving rather than showing one nobody is in', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    act(() => {
      result.current.leave();
    });

    expect(result.current.party).toBeNull();
  });

  it('asks to open a party around what is playing', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      result.current.open('a-film');
    });

    expect(world.sent).toContainEqual({ kind: 'partyOpen', mediaId: 'a-film' });
  });

  it('treats a party with nobody in it as no party, which is what being removed leaves', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    act(() => {
      world.tell(party({ members: [] }));
    });

    expect(result.current.party).toBeNull();
  });

  it('says who removed you, so being thrown out is not a mystery', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tellRemoved('Dan');
    });

    expect(result.current.notice).toBe('Dan removed you from the watch party.');
  });

  it('does not try to get back into a party it was removed from', () => {
    const world = createWorld();

    renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    act(() => {
      world.tellRemoved('Dan');
    });

    act(() => {
      world.resume();
    });

    expect(world.sent.filter((message) => message.kind === 'partyJoin')).toEqual([]);
  });

  it('passes on that a party is asking for a password', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.challenge('party-1', false);
    });

    expect(result.current.passwordWanted).toEqual({ partyId: 'party-1', wasWrong: false });
  });

  it('offers the password with the attempt to join', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      result.current.join('party-1', 'letmein');
    });

    expect(world.sent).toContainEqual({
      kind: 'partyJoin',
      partyId: 'party-1',
      password: 'letmein',
    });
  });

  it('stops asking once an answer has been sent, so the prompt does not sit there', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.challenge('party-1', false);
    });

    act(() => {
      result.current.join('party-1', 'letmein');
    });

    expect(result.current.passwordWanted).toBeNull();
  });

  it('will not follow a position measured before the last skip, which describes a different film', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tellWithCommand(party(), {
        sequence: 1,
        atMs: NOW_MS + 5000,
        byName: 'Dan',
        byConnectionId: 'dan',
        command: { kind: 'seek', atSeconds: 4000 },
      });
    });

    expect(result.current.referenceSeconds).toBeNull();
  });

  it('follows it again once the timekeeper has spoken since', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tellWithCommand(party(), {
        sequence: 1,
        atMs: NOW_MS - 5000,
        byName: 'Dan',
        byConnectionId: 'dan',
        command: { kind: 'seek', atSeconds: 4000 },
      });
    });

    expect(result.current.referenceSeconds).not.toBeNull();
  });

  it('ignores a party event it cannot read, rather than showing half a party', () => {
    const world = createWorld();
    const { result } = renderHook(() => useWatchParty(world.client));

    act(() => {
      world.tell(party());
    });

    act(() => {
      world.tellNonsense();
    });

    expect(result.current.party?.id).toBe('party-1');
  });
});
