import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { ApiKeySchema, CreatedApiKeySchema } from '@ValenceContracts/schemas/ApiKey';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const KeyListSchema = z.object({ keys: z.array(ApiKeySchema) });

const readKey = async (response: Response) => CreatedApiKeySchema.parse(await response.json());

const readOne = async (response: Response) => ApiKeySchema.parse(await response.json());

const readList = async (response: Response) => KeyListSchema.parse(await response.json());

/**
 * Signs somebody in holding exactly the permissions named.
 */
const signedInWith = async (granted: readonly Permission[]) => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
  });

  const cookie = await signUpForTest(app);
  const account = store.user[0];

  if (granted.includes('administrator')) {
    await makeAdministrator(permissions, account?.id ?? '');
  } else {
    const role = await permissions.createRole({
      name: 'Purpose-made',
      position: 200,
      permissions: [...granted],
    });

    await permissions.assignRole(account?.id ?? '', role.id);
  }

  const request = (path: string, method = 'GET', body?: object) =>
    app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: {
        cookie,
        origin: TEST_ORIGIN,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /**
   * The same server, asked by something holding a key rather than a cookie.
   */
  const asKey = (key: string, path: string, method = 'GET') =>
    app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { 'x-api-key': key, origin: TEST_ORIGIN },
    });

  const mint = async (body: object) => readKey(await request('/api/keys', 'POST', body));

  /**
   * The same server, asked by nobody at all.
   */
  const anonymously = (path: string, method = 'GET') =>
    app.request(`${TEST_ORIGIN}${path}`, { method, headers: { origin: TEST_ORIGIN } });

  return { app, request, asKey, mint, anonymously, permissions };
};

describe('holding API keys', () => {
  it('refuses an account that may not hold them', async () => {
    const { request } = await signedInWith([]);

    expect((await request('/api/keys')).status).toBe(403);
  });

  it('lets an account that may hold them list what it has', async () => {
    const { request } = await signedInWith(['account.keys']);

    const response = await request('/api/keys');

    expect(response.status).toBe(200);
    expect((await readList(response)).keys).toEqual([]);
  });

  it('answers with the key itself when it is made, and never again', async () => {
    const { request, mint } = await signedInWith(['account.keys']);

    expect(typeof (await mint({ name: 'Dashboard' })).key).toBe('string');

    const listed = await readList(await request('/api/keys'));

    expect(listed.keys).toHaveLength(1);
    expect(listed.keys[0]).not.toHaveProperty('key');
  });

  it('shows enough of a key to tell it from another without showing the key', async () => {
    const { request, mint } = await signedInWith(['account.keys']);

    await mint({ name: 'Dashboard' });

    const listed = await readList(await request('/api/keys'));

    expect(listed.keys[0]?.start).not.toBeNull();
    expect(listed.keys[0]?.name).toBe('Dashboard');
  });

  it('never expires a key nobody asked to expire', async () => {
    const { mint } = await signedInWith(['account.keys']);

    expect((await mint({ name: 'Script' })).expiresAt).toBeNull();
  });

  it('expires one that was asked to', async () => {
    const { mint } = await signedInWith(['account.keys']);

    const made = await mint({ name: 'Temporary', expiresInDays: 30 });

    expect(Date.parse(made.expiresAt ?? '')).toBeGreaterThan(Date.now());
  });

  it('gives a key no limiter unless one was asked for', async () => {
    const { mint } = await signedInWith(['account.keys']);

    expect((await mint({ name: 'Unlimited' })).rateLimit).toBeNull();
  });

  it('limits a key that was asked to be limited', async () => {
    const { mint } = await signedInWith(['account.keys']);

    const made = await mint({
      name: 'Outside the house',
      rateLimit: { max: 60, everySeconds: 60 },
    });

    expect(made.rateLimit).toEqual({ max: 60, everySeconds: 60 });
  });

  it('turns a key off without destroying it, and back on', async () => {
    const { request, mint } = await signedInWith(['account.keys']);

    const made = await mint({ name: 'Suspect' });

    const off = await request(`/api/keys/${made.id}`, 'PATCH', { enabled: false });

    expect(off.status).toBe(200);
    expect((await readOne(off)).enabled).toBe(false);

    const on = await request(`/api/keys/${made.id}`, 'PATCH', { enabled: true });

    expect((await readOne(on)).enabled).toBe(true);
  });

  it('revokes a key', async () => {
    const { request, mint } = await signedInWith(['account.keys']);

    const made = await mint({ name: 'Old' });

    expect((await request(`/api/keys/${made.id}`, 'DELETE')).status).toBe(204);
    expect((await readList(await request('/api/keys'))).keys).toHaveLength(0);
  });

  it('says there is no such key rather than acting on one that is not there', async () => {
    const { request } = await signedInWith(['account.keys']);

    expect((await request('/api/keys/not-a-key', 'DELETE')).status).toBe(404);
  });
});

describe('what a key may do', () => {
  it('reaches a route its account may reach', async () => {
    const { asKey, mint } = await signedInWith(['account.keys', 'library.create']);

    const made = await mint({ name: 'Scripted' });

    expect((await asKey(made.key, '/api/libraries')).status).toBe(200);
  });

  it('cannot reach a route its account cannot', async () => {
    const { asKey, mint } = await signedInWith(['account.keys']);

    const made = await mint({ name: 'Scripted' });

    expect((await asKey(made.key, '/api/libraries', 'POST')).status).toBe(403);
  });

  it('cannot be granted what its account does not hold, however it is asked for', async () => {
    const { mint } = await signedInWith(['account.keys']);

    const made = await mint({
      name: 'Ambitious',
      permissions: ['administrator', 'library.delete'],
    });

    expect(made.permissions).toEqual([]);
  });

  it('is narrowed to what it names, below what its account holds', async () => {
    const { mint } = await signedInWith(['account.keys', 'library.create', 'jobs.run']);

    const made = await mint({ name: 'Read only', permissions: ['jobs.run'] });

    expect(made.permissions).toEqual(['jobs.run']);
  });

  it('lets an operator hold a key that is not an operator', async () => {
    const { asKey, mint } = await signedInWith(['administrator']);

    const narrow = await mint({ name: 'Narrow', permissions: ['streaming.view'] });

    expect((await asKey(narrow.key, '/api/libraries', 'POST')).status).toBe(403);
  });

  it('gives an unrestricted key everything its account has', async () => {
    const { asKey, mint } = await signedInWith(['administrator']);

    const made = await mint({ name: 'Everything' });

    expect((await asKey(made.key, '/api/libraries')).status).toBe(200);
  });

  it('reaches what it was narrowed to, rather than being narrowed to nothing', async () => {
    const { asKey, mint } = await signedInWith(['account.keys', 'library.create']);

    const made = await mint({ name: 'Just libraries', permissions: ['library.create'] });

    expect((await asKey(made.key, '/api/libraries', 'POST')).status).not.toBe(403);
  });

  it('stops working the moment it is revoked', async () => {
    const { request, asKey, mint } = await signedInWith(['account.keys', 'library.create']);

    const made = await mint({ name: 'Doomed' });

    expect((await asKey(made.key, '/api/libraries')).status).toBe(200);

    await request(`/api/keys/${made.id}`, 'DELETE');

    expect((await asKey(made.key, '/api/libraries')).status).not.toBe(200);
  });

  it('stops working while it is turned off', async () => {
    const { request, asKey, mint } = await signedInWith(['account.keys', 'library.create']);

    const made = await mint({ name: 'Paused' });

    await request(`/api/keys/${made.id}`, 'PATCH', { enabled: false });

    expect((await asKey(made.key, '/api/libraries')).status).not.toBe(200);
  });
});

describe('asking about keys without being signed in', () => {
  it('refuses to list them', async () => {
    const { anonymously } = await signedInWith(['account.keys']);

    expect((await anonymously('/api/keys')).status).toBe(401);
  });

  it('refuses to make one', async () => {
    const { anonymously } = await signedInWith(['account.keys']);

    expect((await anonymously('/api/keys', 'POST')).status).toBe(401);
  });

  it('refuses to turn one off', async () => {
    const { anonymously } = await signedInWith(['account.keys']);

    expect((await anonymously('/api/keys/whatever', 'PATCH')).status).toBe(401);
  });

  it('refuses to revoke one', async () => {
    const { anonymously } = await signedInWith(['account.keys']);

    expect((await anonymously('/api/keys/whatever', 'DELETE')).status).toBe(401);
  });
});

describe('asking about keys without being allowed them', () => {
  it('refuses to make one', async () => {
    const { request } = await signedInWith([]);

    expect((await request('/api/keys', 'POST', { name: 'Nope' })).status).toBe(403);
  });

  it('refuses to turn one off', async () => {
    const { request } = await signedInWith([]);

    expect((await request('/api/keys/whatever', 'PATCH', { enabled: false })).status).toBe(403);
  });

  it('refuses to revoke one', async () => {
    const { request } = await signedInWith([]);

    expect((await request('/api/keys/whatever', 'DELETE')).status).toBe(403);
  });
});

describe('a key against the routes that read an account', () => {
  it('refuses a key that was never issued', async () => {
    const { asKey } = await signedInWith(['account.keys']);

    expect((await asKey('valence_not_a_real_key_at_all', '/api/profiles')).status).toBe(401);
  });
});
