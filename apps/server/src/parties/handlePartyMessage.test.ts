import { describe, expect, it } from 'vitest';
import { createPartyRegistry } from './createPartyRegistry';
import { handlePartyMessage } from './handlePartyMessage';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { FromClient, FromServer } from '@FluxContracts/schemas/Realtime';

const NOW_MS = 1_700_000_000_000;

const someone = (connectionId: string, name: string) => ({
  connectionId,
  accountId: `account-${connectionId}`,
  profileId: null,
  name,
});

const createWorld = () => {
  let minted = 0;
  const told: { to: readonly string[]; payload: JsonValue }[] = [];
  const answers: FromServer[] = [];

  const registry = createPartyRegistry(() => {
    minted += 1;

    return `party-${minted.toString()}`;
  });

  const asked: { byName: string; profileId: string; partyId: string }[] = [];

  const binding = {
    registry,
    tell: (connectionIds: readonly string[], payload: JsonValue) => {
      told.push({ to: connectionIds, payload });
    },
    ask: (asking: { party: { id: string }; byName: string; profileId: string }) => {
      asked.push({
        byName: asking.byName,
        profileId: asking.profileId,
        partyId: asking.party.id,
      });
    },
  };

  const say = (message: FromClient, who: ReturnType<typeof someone>) => {
    handlePartyMessage(
      message,
      who,
      (answer) => {
        answers.push(answer);
      },
      binding,
      () => NOW_MS,
    );
  };

  return {
    registry,
    told,
    asked,
    answers,
    say,
    lastTold: () => told[told.length - 1],
  };
};

const partyIn = (payload: JsonValue | undefined) =>
  payload !== undefined && typeof payload === 'object' && payload !== null && 'party' in payload
    ? payload.party
    : null;

describe('handlePartyMessage', () => {
  it('tells everybody in the party when somebody opens one', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));

    expect(world.lastTold()?.to).toEqual(['dan']);
  });

  it('tells everybody already there when somebody joins', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));

    expect(world.lastTold()?.to).toEqual(['dan', 'sam']);
  });

  it('says so rather than going quiet when the party is not there to join', () => {
    const world = createWorld();

    world.say({ kind: 'partyJoin', partyId: 'nothing' }, someone('sam', 'Sam'));

    expect(world.answers).toEqual([{ kind: 'refused', why: 'That party is not running.' }]);
  });

  it('refuses somebody acting on a party they are not in', () => {
    const world = createWorld();

    world.say(
      { kind: 'partyCommand', command: { kind: 'pause', atSeconds: 4 } },
      someone('sam', 'Sam'),
    );

    expect(world.answers).toEqual([{ kind: 'refused', why: 'You are not in a party.' }]);
  });

  it('passes a command on with who issued it', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say(
      { kind: 'partyCommand', command: { kind: 'pause', atSeconds: 4 } },
      someone('dan', 'Dan'),
    );

    expect(world.lastTold()?.payload).toMatchObject({
      command: { byName: 'Dan', command: { kind: 'pause', atSeconds: 4 } },
    });
  });

  it('sends no command when the host only changes what people may do', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyLoosen', everyoneMaySeek: false }, someone('dan', 'Dan'));

    expect(world.lastTold()?.payload).not.toHaveProperty('command');
  });

  it('sends no command when the host only changes somebody’s role', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partySetRole', connectionId: 'sam', role: 'coHost' }, someone('dan', 'Dan'));

    expect(world.lastTold()?.payload).not.toHaveProperty('command');
  });

  it('carries a report on to everybody, since that is what keeps the room in step', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say(
      {
        kind: 'partyReport',
        positionSeconds: 42,
        bufferedAheadSeconds: 5,
        isWatching: true,
        isReady: true,
      },
      someone('dan', 'Dan'),
    );

    expect(partyIn(world.lastTold()?.payload)).toMatchObject({
      members: [{ positionSeconds: 42, isWatching: true }],
    });
  });

  it('stamps a report with when it arrived, so a stale one can be read as stale', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say(
      {
        kind: 'partyReport',
        positionSeconds: 42,
        bufferedAheadSeconds: 5,
        isWatching: true,
        isReady: true,
      },
      someone('dan', 'Dan'),
    );

    const party = partyIn(world.lastTold()?.payload);
    const stamped =
      party !== null && typeof party === 'object' && 'members' in party
        ? JSON.stringify(party.members)
        : '';

    expect(stamped).toContain('reportedAtMs');
  });

  it('tells the rest of the party when somebody leaves', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyLeave' }, someone('sam', 'Sam'));

    expect(world.lastTold()?.to).toEqual(['dan']);
  });

  it('refuses a guest the controls for running the party, whatever their client shows', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyLoosen', everyoneMaySeek: false }, someone('sam', 'Sam'));

    expect(world.answers.at(-1)?.kind).toBe('refused');
  });

  it('tells the person removed, and says who did it', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyRemove', connectionId: 'sam' }, someone('dan', 'Dan'));

    const toSam = world.told.find((one) => one.to.length === 1 && one.to[0] === 'sam');

    expect(toSam?.payload).toMatchObject({ notice: { kind: 'removed', byName: 'Dan' } });
  });

  it('leaves the person removed holding a party with nobody in it, which is none', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyRemove', connectionId: 'sam' }, someone('dan', 'Dan'));

    const toSam = world.told.find((one) => one.to.length === 1 && one.to[0] === 'sam');

    expect(partyIn(toSam?.payload)).toMatchObject({ members: [] });
  });

  it('tells the rest of the party who is left', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyRemove', connectionId: 'sam' }, someone('dan', 'Dan'));

    expect(world.lastTold()?.to).toEqual(['dan']);
  });

  it('asks for the password rather than refusing outright, so it can be offered', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partySetPassword', password: 'letmein' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));

    expect(world.answers.at(-1)).toEqual({
      kind: 'partyNeedsPassword',
      partyId: 'party-1',
      wasWrong: false,
    });
  });

  it('lets somebody in who offers the password', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partySetPassword', password: 'letmein' }, someone('dan', 'Dan'));
    world.say(
      { kind: 'partyJoin', partyId: 'party-1', password: 'letmein' },
      someone('sam', 'Sam'),
    );

    expect(world.lastTold()?.to).toEqual(['dan', 'sam']);
  });

  it('never puts the password in what it sends the party', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partySetPassword', password: 'letmein' }, someone('dan', 'Dan'));

    expect(JSON.stringify(world.told)).not.toContain('letmein');
  });

  it('says there is a password, which is what a joiner needs to know', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partySetPassword', password: 'letmein' }, someone('dan', 'Dan'));

    expect(partyIn(world.lastTold()?.payload)).toMatchObject({ hasPassword: true });
  });

  it('turns away somebody the host has already removed', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyRemove', connectionId: 'sam' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));

    expect(world.answers.at(-1)).toEqual({
      kind: 'refused',
      why: 'The host has removed you from that party.',
    });
  });

  it('asks somebody along on behalf of whoever asked for them', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyInvite', profileId: 'profile-sam' }, someone('dan', 'Dan'));

    expect(world.asked).toEqual([{ byName: 'Dan', profileId: 'profile-sam', partyId: 'party-1' }]);
  });

  it('refuses a guest asking somebody along, and tells them why', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say({ kind: 'partyInvite', profileId: 'profile-kit' }, someone('sam', 'Sam'));

    expect(world.asked).toEqual([]);
    expect(world.answers.at(-1)?.kind).toBe('refused');
  });

  it('says the room is waiting until everybody has something to play', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.say(
      {
        kind: 'partyReport',
        positionSeconds: 10,
        bufferedAheadSeconds: 9,
        isWatching: true,
        isReady: true,
      },
      someone('dan', 'Dan'),
    );

    expect(partyIn(world.lastTold()?.payload)).toMatchObject({ isHeld: true });
  });
});

describe('what a party is told when a request cannot be granted', () => {
  it('says so rather than going quiet when somebody who is not the host removes another', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));
    world.answers.length = 0;

    world.say({ kind: 'partyRemove', connectionId: 'dan' }, someone('sam', 'Sam'));

    expect(world.answers[0]).toMatchObject({ kind: 'refused' });
  });

  it('takes somebody out when the host asks, and tells them they were removed', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyJoin', partyId: 'party-1' }, someone('sam', 'Sam'));

    world.say({ kind: 'partyRemove', connectionId: 'sam' }, someone('dan', 'Dan'));

    expect(world.told.some((one) => one.to.includes('sam'))).toBe(true);
  });

  it('loosens only what was asked about, leaving the rest as it was', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyLoosen', everyoneMaySeek: true }, someone('dan', 'Dan'));

    expect(partyIn(world.lastTold()?.payload)).toMatchObject({ everyoneMaySeek: true });
  });

  it('loosens who may press play without being asked about seeking', () => {
    const world = createWorld();

    world.say({ kind: 'partyOpen', mediaId: 'a-film' }, someone('dan', 'Dan'));
    world.say({ kind: 'partyLoosen', everyoneMayPlayPause: true }, someone('dan', 'Dan'));

    expect(partyIn(world.lastTold()?.payload)).toMatchObject({ everyoneMayPlayPause: true });
  });

  it('says nothing at all about a party message from somebody in no party', () => {
    const world = createWorld();

    world.say({ kind: 'partyLoosen', everyoneMaySeek: true }, someone('a-stranger', 'Nobody'));

    expect(world.told).toEqual([]);
  });
});
