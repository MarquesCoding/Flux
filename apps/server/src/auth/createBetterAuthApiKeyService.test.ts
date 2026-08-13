import { describe, expect, it } from 'vitest';
import {
  createBetterAuthApiKeyService,
  readPermissions,
  NAMESPACE,
} from './createBetterAuthApiKeyService';
import { createMemoryAuth } from './createMemoryAuth';

/**
 * A signed-in account, and the headers that prove it.
 */
const signedIn = async () => {
  const { auth } = createMemoryAuth();
  const keys = createBetterAuthApiKeyService(auth);
  const email = 'holder@flux.test';

  await auth.api.signUpEmail({ body: { email, password: 'a-long-enough-password', name: 'A' } });

  const answer = await auth.api.signInEmail({
    body: { email, password: 'a-long-enough-password' },
    asResponse: true,
  });

  const headers = new Headers({ cookie: answer.headers.get('set-cookie') ?? '' });
  const session = await auth.api.getSession({ headers });

  return { auth, keys, headers, accountId: session?.user.id ?? '' };
};

describe('keys kept where better-auth keeps them', () => {
  it('has none until one is made', async () => {
    const { keys, headers } = await signedIn();

    expect(await keys.list(headers)).toEqual([]);
  });

  it('answers with the key itself when it is made', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Dashboard',
      expiresInDays: null,
      permissions: null,
      rateLimit: null,
    });

    expect(made.key).toMatch(/\S/);
    expect(made.name).toBe('Dashboard');
    expect((await keys.list(headers))[0]?.id).toBe(made.id);
  });

  it('leaves a key unrestricted when nothing narrowed it', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Everything',
      expiresInDays: null,
      permissions: null,
      rateLimit: null,
    });

    expect(await keys.restrictionFor(headers, made.id)).toBeNull();
  });

  it('remembers what a key was narrowed to', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Narrow',
      expiresInDays: null,
      permissions: ['jobs.run'],
      rateLimit: null,
    });

    expect(await keys.restrictionFor(headers, made.id)).toEqual(new Set(['jobs.run']));
  });

  it('narrows a key to nothing when it was asked for nothing', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Powerless',
      expiresInDays: null,
      permissions: [],
      rateLimit: null,
    });

    expect(await keys.restrictionFor(headers, made.id)).toEqual(new Set());
  });

  it('gives a key that is not there no authority rather than all of it', async () => {
    const { keys, headers } = await signedIn();

    expect(await keys.restrictionFor(headers, 'not-a-key')).toEqual(new Set());
  });

  it('expires a key that was asked to expire', async () => {
    const { keys, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Temporary',
      expiresInDays: 30,
      permissions: null,
      rateLimit: null,
    });

    expect(Date.parse(made.expiresAt ?? '')).toBeGreaterThan(Date.now());
  });

  it('turns a key off and back on', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Suspect',
      expiresInDays: null,
      permissions: null,
      rateLimit: null,
    });

    expect((await keys.setEnabled(headers, made.id, false))?.enabled).toBe(false);
    expect((await keys.setEnabled(headers, made.id, true))?.enabled).toBe(true);
  });

  it('answers with nothing when asked to turn off a key that is not there', async () => {
    const { keys, headers } = await signedIn();

    expect(await keys.setEnabled(headers, 'not-a-key', false)).toBeNull();
  });

  it('revokes a key', async () => {
    const { keys, headers, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Old',
      expiresInDays: null,
      permissions: null,
      rateLimit: null,
    });

    expect(await keys.revoke(headers, made.id)).toBe(true);
    expect(await keys.list(headers)).toEqual([]);
  });

  it('says so rather than throwing when revoking a key that is not there', async () => {
    const { keys, headers } = await signedIn();

    expect(await keys.revoke(headers, 'not-a-key')).toBe(false);
  });

  it('lists nothing rather than throwing when nobody is signed in', async () => {
    const { keys } = await signedIn();

    expect(await keys.list(new Headers())).toEqual([]);
  });
});

describe('rate limiting a key', () => {
  it('leaves a key unlimited when nothing asked for a limit', async () => {
    const { keys, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Unlimited',
      expiresInDays: null,
      permissions: null,
      rateLimit: null,
    });

    expect(made.rateLimit).toBeNull();
  });

  it('records the limit it was given, in seconds rather than milliseconds', async () => {
    const { keys, accountId } = await signedIn();

    const made = await keys.create(accountId, {
      name: 'Limited',
      expiresInDays: null,
      permissions: null,
      rateLimit: { max: 30, everySeconds: 60 },
    });

    expect(made.rateLimit).toEqual({ max: 30, everySeconds: 60 });
  });
});

describe('readPermissions', () => {
  it('reads an unrestricted key as unrestricted, not as restricted to nothing', () => {
    expect(readPermissions(null)).toBeNull();
    expect(readPermissions(undefined)).toBeNull();
    expect(readPermissions({})).toBeNull();
  });

  it('ignores a list belonging to somebody else’s vocabulary', () => {
    expect(readPermissions({ somebodyElse: ['whatever'] })).toBeNull();
  });

  it('reads the ones it recognises', () => {
    expect(readPermissions({ [NAMESPACE]: ['jobs.run', 'library.create'] })).toEqual([
      'jobs.run',
      'library.create',
    ]);
  });

  it('drops a permission Flux no longer has rather than carrying a ghost of it', () => {
    expect(readPermissions({ [NAMESPACE]: ['jobs.run', 'library.timeTravel'] })).toEqual([
      'jobs.run',
    ]);
  });

  it('reads a key restricted to nothing as restricted to nothing', () => {
    expect(readPermissions({ [NAMESPACE]: [] })).toEqual([]);
  });
});
