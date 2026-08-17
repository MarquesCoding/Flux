import { describe, expect, it } from 'vitest';
import { createPartyRegistry } from './createPartyRegistry';

const someone = (connectionId: string, name: string) => ({
  connectionId,
  accountId: `account-${connectionId}`,
  profileId: null,
  name,
});

const createWorld = () => {
  let minted = 0;

  return createPartyRegistry(() => {
    minted += 1;

    return `party-${minted.toString()}`;
  });
};

const openWith = (registry: ReturnType<typeof createWorld>) =>
  registry.open({ mediaId: 'a-film', host: someone('host', 'Dan') });

describe('opening a party', () => {
  it('puts the person who opened it in charge', () => {
    const party = openWith(createWorld());

    expect(party.members[0]?.role).toBe('host');
  });

  it('starts open, since that is right among friends', () => {
    const party = openWith(createWorld());

    expect(party.everyoneMaySeek).toBe(true);
    expect(party.everyoneMayPlayPause).toBe(true);
  });

  it('makes the only member the one keeping time', () => {
    const party = openWith(createWorld());

    expect(party.timekeeperId).toBe('host');
  });
});

describe('joining', () => {
  it('lets somebody in', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    const party = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(party?.members).toHaveLength(2);
  });

  it('brings somebody in as a guest rather than in charge', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    const party = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(party?.members[1]?.role).toBe('guest');
  });

  it('leaves the first arrival keeping time', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    const party = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(party?.timekeeperId).toBe('host');
  });

  it('does not let somebody join twice', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const party = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(party?.members).toHaveLength(2);
  });

  it('says nothing for a party that is not running', () => {
    expect(createWorld().join({ partyId: 'nowhere', ...someone('sam', 'Sam') })).toBeNull();
  });
});

describe('leaving', () => {
  it('takes somebody out', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.leave('sam')?.members).toHaveLength(1);
  });

  it('carries on after the host goes, since control was shared anyway', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.leave('host')?.members).toHaveLength(1);
  });

  it('hands the party to somebody rather than leaving it unsteerable', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.leave('host')?.members[0]?.role).toBe('host');
  });

  it('hands timekeeping on when the timekeeper goes', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.leave('host')?.timekeeperId).toBe('sam');
  });

  it('ends when the last person leaves, not when a particular one does', () => {
    const registry = createWorld();

    openWith(registry);
    registry.leave('host');

    expect(registry.count()).toBe(0);
  });

  it('says nothing for somebody who was never in a party', () => {
    expect(createWorld().leave('nobody')).toBeNull();
  });
});

describe('issuing a command', () => {
  it('lets a guest pause while the party is open', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.issue(opened.id, 'sam', { kind: 'pause', atSeconds: 12 }, 1).kind).toBe('sent');
  });

  it('names who did it, so a party does not feel haunted', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const issued = registry.issue(opened.id, 'sam', { kind: 'pause', atSeconds: 12 }, 1);

    expect(issued.kind === 'sent' ? issued.command.byName : '').toBe('Sam');
  });

  it('stamps commands in an order everybody will agree on', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    const first = registry.issue(opened.id, 'sam', { kind: 'pause', atSeconds: 1 }, 1);
    const second = registry.issue(opened.id, 'host', { kind: 'play', atSeconds: 1 }, 2);

    const one = first.kind === 'sent' ? first.command.sequence : 0;
    const other = second.kind === 'sent' ? second.command.sequence : 0;

    expect(other).toBeGreaterThan(one);
  });

  it('refuses a guest seeking once the host has tightened it', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.loosen(opened.id, 'host', { everyoneMaySeek: false });

    expect(registry.issue(opened.id, 'sam', { kind: 'seek', atSeconds: 90 }, 1).kind).toBe(
      'refused',
    );
  });

  it('still lets that guest pause, since the two are separate', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.loosen(opened.id, 'host', { everyoneMaySeek: false });

    expect(registry.issue(opened.id, 'sam', { kind: 'pause', atSeconds: 1 }, 1).kind).toBe('sent');
  });

  it('says why a command was refused rather than doing nothing', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.loosen(opened.id, 'host', { everyoneMaySeek: false });
    const refused = registry.issue(opened.id, 'sam', { kind: 'seek', atSeconds: 90 }, 1);

    expect(refused.kind === 'refused' ? refused.why : '').not.toBe('');
  });

  it('refuses somebody who is not in the party at all', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    expect(registry.issue(opened.id, 'stranger', { kind: 'pause', atSeconds: 1 }, 1).kind).toBe(
      'refused',
    );
  });

  it('refuses a command for a party that is not running', () => {
    expect(
      createWorld().issue('nowhere', 'somebody', { kind: 'pause', atSeconds: 1 }, 1).kind,
    ).toBe('refused');
  });

  it('never lets a guest change what everybody is watching', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(
      registry.issue(opened.id, 'sam', { kind: 'changeWhatIsPlaying', mediaId: 'other' }, 1).kind,
    ).toBe('refused');
  });

  it('changes what the party is watching when somebody may', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.issue(opened.id, 'host', { kind: 'changeWhatIsPlaying', mediaId: 'other' }, 1);

    expect(registry.find(opened.id)?.mediaId).toBe('other');
  });
});

describe('who may change the party itself', () => {
  it('lets the host promote somebody', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const done = registry.setRole(opened.id, 'host', 'sam', 'coHost');

    expect(done.kind).toBe('sent');
    expect(registry.find(opened.id)?.members[1]?.role).toBe('coHost');
  });

  it('refuses a guest promoting themselves', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.setRole(opened.id, 'sam', 'sam', 'host').kind).toBe('refused');
  });

  it('refuses a co-host tightening the party, which is the host s to decide', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.setRole(opened.id, 'host', 'sam', 'coHost');

    expect(registry.loosen(opened.id, 'sam', { everyoneMaySeek: false }).kind).toBe('refused');
  });

  it('leaves what was not mentioned alone', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.loosen(opened.id, 'host', { everyoneMaySeek: false });

    expect(registry.find(opened.id)?.everyoneMayPlayPause).toBe(true);
  });
});

describe('reporting where somebody is', () => {
  it('remembers what each member reported', () => {
    const registry = createWorld();

    openWith(registry);
    const party = registry.report('host', {
      positionSeconds: 42,
      bufferedAheadSeconds: 8,
      isWatching: true,
    });

    expect(party?.members[0]).toMatchObject({ positionSeconds: 42, isWatching: true });
  });

  it('says nothing for somebody in no party', () => {
    expect(
      createWorld().report('nobody', {
        positionSeconds: 1,
        bufferedAheadSeconds: 1,
        isWatching: true,
      }),
    ).toBeNull();
  });
});

describe('finding a party', () => {
  it('finds the party somebody is in', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    expect(registry.partyOf('host')?.id).toBe(opened.id);
  });

  it('says nothing for somebody in none', () => {
    expect(createWorld().partyOf('nobody')).toBeNull();
  });

  it('forgets where somebody was once they have left', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.leave('sam');

    expect(registry.partyOf('sam')).toBeNull();
  });
});
