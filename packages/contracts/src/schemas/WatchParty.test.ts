import { describe, expect, it } from 'vitest';
import {
  PARTY_ROLES,
  PartyCommandSchema,
  partyAllows,
  powerForCommand,
  powersOf,
  whoKeepsTime,
} from './WatchParty';
import type { PartyMember, PartyRole } from './WatchParty';

const OPEN = { everyoneMaySeek: true, everyoneMayPlayPause: true };
const SHUT = { everyoneMaySeek: false, everyoneMayPlayPause: false };

const member = (over?: Partial<PartyMember>): PartyMember => ({
  connectionId: 'one',
  accountId: 'account',
  profileId: null,
  name: 'Sam',
  role: 'guest',
  joinedAtMs: 1000,
  isWatching: true,
  positionSeconds: 0,
  bufferedAheadSeconds: 0,
  ...over,
});

describe('powersOf', () => {
  it('gives the host everything', () => {
    expect(powersOf('host')).toContain('manageParty');
    expect(powersOf('host')).toContain('seek');
  });

  it('gives a co-host playback control but not the party itself', () => {
    expect(powersOf('coHost')).toContain('seek');
    expect(powersOf('coHost')).not.toContain('manageParty');
  });

  it('gives a guest no powers of its own', () => {
    expect(powersOf('guest')).toStrictEqual([]);
  });

  it('answers for every role, so a new one cannot arrive undecided', () => {
    for (const role of PARTY_ROLES) {
      expect(powersOf(role)).toBeDefined();
    }
  });
});

describe('powerForCommand', () => {
  it('treats play and pause as the same power', () => {
    expect(powerForCommand({ kind: 'play', atSeconds: 0 })).toBe(
      powerForCommand({ kind: 'pause', atSeconds: 0 }),
    );
  });

  it('keeps seeking apart from pausing, since it is far more disruptive', () => {
    expect(powerForCommand({ kind: 'seek', atSeconds: 10 })).not.toBe(
      powerForCommand({ kind: 'pause', atSeconds: 0 }),
    );
  });
});

describe('partyAllows', () => {
  it('lets anybody pause by default, which is right among friends', () => {
    expect(partyAllows(OPEN, 'guest', { kind: 'pause', atSeconds: 0 })).toBe(true);
  });

  it('lets anybody seek by default', () => {
    expect(partyAllows(OPEN, 'guest', { kind: 'seek', atSeconds: 30 })).toBe(true);
  });

  it('stops a guest seeking once the party is tightened', () => {
    expect(partyAllows(SHUT, 'guest', { kind: 'seek', atSeconds: 30 })).toBe(false);
  });

  it('stops a guest pausing once the party is tightened', () => {
    expect(partyAllows(SHUT, 'guest', { kind: 'pause', atSeconds: 0 })).toBe(false);
  });

  it('lets a party forbid seeking while still allowing pausing', () => {
    const tightened = { everyoneMaySeek: false, everyoneMayPlayPause: true };

    expect(partyAllows(tightened, 'guest', { kind: 'pause', atSeconds: 0 })).toBe(true);
    expect(partyAllows(tightened, 'guest', { kind: 'seek', atSeconds: 30 })).toBe(false);
  });

  it('leaves a co-host in control however tight the party is', () => {
    expect(partyAllows(SHUT, 'coHost', { kind: 'seek', atSeconds: 30 })).toBe(true);
    expect(partyAllows(SHUT, 'coHost', { kind: 'pause', atSeconds: 0 })).toBe(true);
  });

  it('leaves the host in control however tight the party is', () => {
    expect(partyAllows(SHUT, 'host', { kind: 'seek', atSeconds: 30 })).toBe(true);
  });

  it('never lets a guest change what everybody is watching, however open the party', () => {
    expect(partyAllows(OPEN, 'guest', { kind: 'changeWhatIsPlaying', mediaId: 'other' })).toBe(
      false,
    );
  });

  it('lets a co-host change what is playing', () => {
    expect(partyAllows(SHUT, 'coHost', { kind: 'changeWhatIsPlaying', mediaId: 'other' })).toBe(
      true,
    );
  });
});

describe('whoKeepsTime', () => {
  it('picks nobody for an empty party', () => {
    expect(whoKeepsTime([])).toBeNull();
  });

  it('picks whoever has been there longest', () => {
    const chosen = whoKeepsTime([
      member({ connectionId: 'later', joinedAtMs: 3000 }),
      member({ connectionId: 'earlier', joinedAtMs: 1000 }),
    ]);

    expect(chosen).toBe('earlier');
  });

  it('answers the same for everybody when two joined at once', () => {
    const one = whoKeepsTime([
      member({ connectionId: 'b', joinedAtMs: 1000 }),
      member({ connectionId: 'a', joinedAtMs: 1000 }),
    ]);
    const other = whoKeepsTime([
      member({ connectionId: 'a', joinedAtMs: 1000 }),
      member({ connectionId: 'b', joinedAtMs: 1000 }),
    ]);

    expect(one).toBe(other);
  });

  it('does not depend on the order it was given', () => {
    const members = [
      member({ connectionId: 'c', joinedAtMs: 3000 }),
      member({ connectionId: 'a', joinedAtMs: 1000 }),
      member({ connectionId: 'b', joinedAtMs: 2000 }),
    ];

    expect(whoKeepsTime(members)).toBe(whoKeepsTime([...members].reverse()));
  });
});

describe('PartyCommandSchema', () => {
  it('reads a pause', () => {
    expect(PartyCommandSchema.safeParse({ kind: 'pause', atSeconds: 12 }).success).toBe(true);
  });

  it('refuses a command it does not know', () => {
    expect(PartyCommandSchema.safeParse({ kind: 'selfDestruct' }).success).toBe(false);
  });

  it('refuses a seek to before the beginning', () => {
    expect(PartyCommandSchema.safeParse({ kind: 'seek', atSeconds: -5 }).success).toBe(false);
  });
});

describe('the subtractive rule', () => {
  it('grants no power to a role that does not hold it, whatever the party says', () => {
    const openest = { everyoneMaySeek: true, everyoneMayPlayPause: true };
    const guestPowers: PartyRole = 'guest';

    expect(
      partyAllows(openest, guestPowers, { kind: 'changeWhatIsPlaying', mediaId: 'other' }),
    ).toBe(false);
  });
});
