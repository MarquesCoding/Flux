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

    const joined = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(joined.kind === 'joined' ? joined.party.members : []).toHaveLength(2);
  });

  it('brings somebody in as a guest rather than in charge', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    const joined = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(joined.kind === 'joined' ? joined.party.members[1]?.role : null).toBe('guest');
  });

  it('leaves the first arrival keeping time', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    const joined = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(joined.kind === 'joined' ? joined.party.timekeeperId : null).toBe('host');
  });

  it('does not let somebody join twice', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const joined = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(joined.kind === 'joined' ? joined.party.members : []).toHaveLength(2);
  });

  it('says nothing for a party that is not running', () => {
    expect(createWorld().join({ partyId: 'nowhere', ...someone('sam', 'Sam') }).kind).toBe(
      'unknown',
    );
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

    expect(issued.kind === 'sent' ? issued.command?.byName : '').toBe('Sam');
  });

  it('stamps commands in an order everybody will agree on', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    const first = registry.issue(opened.id, 'sam', { kind: 'pause', atSeconds: 1 }, 1);
    const second = registry.issue(opened.id, 'host', { kind: 'play', atSeconds: 1 }, 2);

    const one = first.kind === 'sent' ? (first.command?.sequence ?? 0) : 0;
    const other = second.kind === 'sent' ? (second.command?.sequence ?? 0) : 0;

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

describe('removing somebody', () => {
  it('takes them out of the party', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const gone = registry.remove(opened.id, 'host', 'sam');

    expect(gone.kind === 'removed' ? gone.party?.members : []).toHaveLength(1);
  });

  it('is the host\u2019s to do and nobody else\u2019s', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.join({ partyId: opened.id, ...someone('kit', 'Kit') });

    expect(registry.remove(opened.id, 'sam', 'kit').kind).toBe('refused');
  });

  it('refuses a co-host, since removing people is not part of running the film', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.join({ partyId: opened.id, ...someone('kit', 'Kit') });
    registry.setRole(opened.id, 'host', 'sam', 'coHost');

    expect(registry.remove(opened.id, 'sam', 'kit').kind).toBe('refused');
  });

  it('will not have the host remove themselves, since leaving is the door for that', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    expect(registry.remove(opened.id, 'host', 'host').kind).toBe('refused');
  });

  it('keeps them out afterwards, an invitation being no harder to open twice', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.remove(opened.id, 'host', 'sam');

    expect(registry.join({ partyId: opened.id, ...someone('sam', 'Sam') }).kind).toBe('notWelcome');
  });

  it('keeps out the account rather than the connection, which they can simply open again', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    registry.remove(opened.id, 'host', 'sam');

    const again = registry.join({
      partyId: opened.id,
      connectionId: 'sam-again',
      accountId: 'account-sam',
      profileId: null,
      name: 'Sam',
    });

    expect(again.kind).toBe('notWelcome');
  });

  it('says who did it, so the person removed is not left guessing', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });
    const gone = registry.remove(opened.id, 'host', 'sam');

    expect(gone.kind === 'removed' ? gone.byName : '').toBe('Dan');
  });
});

describe('a password on the party', () => {
  const withPassword = () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.setPassword(opened.id, 'host', 'letmein');

    return { registry, opened };
  };

  it('is the host\u2019s to set and nobody else\u2019s', () => {
    const registry = createWorld();
    const opened = openWith(registry);

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(registry.setPassword(opened.id, 'sam', 'letmein').kind).toBe('refused');
  });

  it('turns away somebody who does not offer it', () => {
    const { registry, opened } = withPassword();

    expect(registry.join({ partyId: opened.id, ...someone('sam', 'Sam') }).kind).toBe(
      'needsPassword',
    );
  });

  it('turns away somebody who offers the wrong one', () => {
    const { registry, opened } = withPassword();
    const turned = registry.join({
      partyId: opened.id,
      ...someone('sam', 'Sam'),
      password: 'guess',
    });

    expect(turned).toEqual({ kind: 'needsPassword', wasWrong: true });
  });

  it('does not claim a first attempt was wrong, since none was made', () => {
    const { registry, opened } = withPassword();
    const turned = registry.join({ partyId: opened.id, ...someone('sam', 'Sam') });

    expect(turned).toEqual({ kind: 'needsPassword', wasWrong: false });
  });

  it('lets somebody in who offers it', () => {
    const { registry, opened } = withPassword();
    const joined = registry.join({
      partyId: opened.id,
      ...someone('sam', 'Sam'),
      password: 'letmein',
    });

    expect(joined.kind).toBe('joined');
  });

  it('does not ask again of somebody already in it on another tab', () => {
    const { registry, opened } = withPassword();

    registry.join({ partyId: opened.id, ...someone('sam', 'Sam'), password: 'letmein' });

    const second = registry.join({
      partyId: opened.id,
      connectionId: 'sam-phone',
      accountId: 'account-sam',
      profileId: null,
      name: 'Sam',
    });

    expect(second.kind).toBe('joined');
  });

  it('says there is one without saying what it is', () => {
    const { registry, opened } = withPassword();
    const party = registry.find(opened.id);

    expect(party?.hasPassword).toBe(true);
    expect(JSON.stringify(party)).not.toContain('letmein');
  });

  it('survives the party changing in every other way', () => {
    const { registry, opened } = withPassword();

    registry.loosen(opened.id, 'host', { everyoneMaySeek: false });
    registry.issue(opened.id, 'host', { kind: 'pause', atSeconds: 4 }, 1);

    expect(registry.join({ partyId: opened.id, ...someone('sam', 'Sam') }).kind).toBe(
      'needsPassword',
    );
  });

  it('can be taken off again', () => {
    const { registry, opened } = withPassword();

    registry.setPassword(opened.id, 'host', null);

    expect(registry.join({ partyId: opened.id, ...someone('sam', 'Sam') }).kind).toBe('joined');
  });
});
