import { describe, expect, it } from 'vitest';
import {
  ADMIN_TOPICS,
  FromClientSchema,
  FromServerSchema,
  REALTIME_TOPICS,
  VIEWER_TOPICS,
  mayHearTopic,
  permissionForTopic,
  splitByEntitlement,
} from './Realtime';
import type { Permission } from './Permission';

const held = (...permissions: Permission[]): ReadonlySet<Permission> => new Set(permissions);

describe('permissionForTopic', () => {
  it('asks nothing beyond a session for a viewer topic', () => {
    for (const topic of VIEWER_TOPICS) {
      expect(permissionForTopic(topic)).toBeNull();
    }
  });

  it('names a permission for every admin topic', () => {
    for (const topic of ADMIN_TOPICS) {
      expect(permissionForTopic(topic)).not.toBeNull();
    }
  });

  it('covers every topic, so a new one cannot be broadcast undecided', () => {
    for (const topic of REALTIME_TOPICS) {
      expect(permissionForTopic(topic)).toBeDefined();
    }
  });
});

describe('mayHearTopic', () => {
  it('lets somebody with no permissions at all hear a viewer topic', () => {
    expect(mayHearTopic('media', held())).toBe(true);
  });

  it('refuses an admin topic to somebody holding nothing', () => {
    expect(mayHearTopic('logs', held())).toBe(false);
  });

  it('refuses an admin topic to somebody holding a different permission', () => {
    expect(mayHearTopic('logs', held('server.monitor'))).toBe(false);
  });

  it('allows an admin topic to somebody holding exactly its permission', () => {
    expect(mayHearTopic('logs', held('server.logs'))).toBe(true);
  });

  it('reads sessions from streaming.view rather than an admin flag', () => {
    expect(mayHearTopic('sessions', held('streaming.view'))).toBe(true);
  });
});

describe('splitByEntitlement', () => {
  it('keeps the viewer topics and refuses the admin ones for an ordinary viewer', () => {
    const split = splitByEntitlement(['media', 'notifications', 'monitor', 'logs'], held());

    expect(split.allowed).toStrictEqual(['media', 'notifications']);
    expect(split.refused).toStrictEqual(['monitor', 'logs']);
  });

  it('allows both feeds on one connection where the permissions are held', () => {
    const split = splitByEntitlement(['media', 'monitor'], held('server.monitor'));

    expect(split.allowed).toStrictEqual(['media', 'monitor']);
    expect(split.refused).toStrictEqual([]);
  });

  it('refuses each admin topic separately rather than as one block', () => {
    const split = splitByEntitlement(['monitor', 'sessions', 'logs'], held('server.monitor'));

    expect(split.allowed).toStrictEqual(['monitor']);
    expect(split.refused).toStrictEqual(['sessions', 'logs']);
  });
});

describe('FromClientSchema', () => {
  it('reads a subscribe', () => {
    const read = FromClientSchema.safeParse({ kind: 'subscribe', topics: ['media'] });

    expect(read.success).toBe(true);
  });

  it('refuses a topic it does not know', () => {
    const read = FromClientSchema.safeParse({ kind: 'subscribe', topics: ['everything'] });

    expect(read.success).toBe(false);
  });

  it('refuses an empty subscription rather than treating it as all of them', () => {
    const read = FromClientSchema.safeParse({ kind: 'subscribe', topics: [] });

    expect(read.success).toBe(false);
  });

  it('refuses a message of a kind it does not know', () => {
    const read = FromClientSchema.safeParse({ kind: 'shutdown' });

    expect(read.success).toBe(false);
  });

  it('reads an identify carrying no profile', () => {
    const read = FromClientSchema.safeParse({ kind: 'identify', profileId: null });

    expect(read.success).toBe(true);
  });

  it('refuses an identify naming something that is not a profile id', () => {
    const read = FromClientSchema.safeParse({ kind: 'identify', profileId: 'someone-else' });

    expect(read.success).toBe(false);
  });
});

describe('FromServerSchema', () => {
  it('reads an event', () => {
    const read = FromServerSchema.safeParse({
      kind: 'event',
      topic: 'media',
      atMs: 1,
      folded: 0,
      payload: { added: 3 },
    });

    expect(read.success).toBe(true);
  });

  it('refuses an event whose timestamp runs backwards', () => {
    const read = FromServerSchema.safeParse({
      kind: 'event',
      topic: 'media',
      atMs: -1,
      folded: 0,
      payload: null,
    });

    expect(read.success).toBe(false);
  });
});
