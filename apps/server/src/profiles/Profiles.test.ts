import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createMemoryProfileService } from './createMemoryProfileService';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { makeAdministrator } from '@FluxServer/auth/signUpForTest';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const ProfileListSchema = z.object({
  profiles: z.array(z.object({ id: z.string(), name: z.string(), updatedAt: z.string() })),
});

const build = (
  promoteProfile?: (request: {
    profileId: string;
    email: string;
    password: string;
  }) => Promise<
    { kind: 'promoted'; profile: ViewerProfile } | { kind: 'taken' } | { kind: 'missing' }
  >,
) => {
  const { auth, settings, store } = createMemoryAuth();
  const profiles = createMemoryProfileService();
  const permissions = createMemoryPermissionService();

  const app = createApp({
    auth,
    settings,
    permissions,
    ...(promoteProfile === undefined ? {} : { promoteProfile }),
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    profiles,
  });

  return { app, profiles, store, permissions };
};

/**
 * Somebody signed in, and the cookie that says so.
 */
const signedIn = async (
  app: ReturnType<typeof build>['app'],
  credentials = CREDENTIALS,
): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(credentials),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

/**
 * Points a held profile at the address its account actually signs in with.
 */
const named = (profiles: ReturnType<typeof build>['profiles'], profileId: string): void => {
  const held = profiles.state.find((candidate) => candidate.profile.id === profileId);

  if (held !== undefined) {
    held.email = CREDENTIALS.email;
  }
};

const read = async (app: ReturnType<typeof build>['app'], cookie: string) =>
  ProfileListSchema.parse(
    await (await app.request(`${BASE}/api/profiles`, { headers: { cookie, origin: BASE } })).json(),
  ).profiles;

describe('profiles over HTTP', () => {
  it('tells somebody who is not signed in nothing about an account', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/profiles`);

    expect(response.status).toBe(401);
  });

  it('makes a profile for an account that has none, since viewing has to hang on something', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect(await read(app, cookie)).toHaveLength(1);
  });

  it('adds somebody to the account', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await read(app, cookie);

    const response = await app.request(`${BASE}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ name: 'Sam', colour: '#3ac47d' }),
    });

    expect(response.status).toBe(201);
    expect(await read(app, cookie)).toHaveLength(2);
  });

  it('refuses a colour outside the set everything is tuned against', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ name: 'Sam', colour: '#123456' }),
    });

    expect(response.status).toBe(400);
  });

  it('changes what somebody is called', async () => {
    const { app } = build();
    const cookie = await signedIn(app);
    const [profile] = await read(app, cookie);

    const response = await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ name: 'Sam', colour: '#3ac47d' }),
    });

    expect(response.status).toBe(204);
    expect((await read(app, cookie))[0]?.name).toBe('Sam');
  });

  it('changes the address of a picture when the picture changes', async () => {
    const { app } = build();
    const cookie = await signedIn(app);
    const [before] = await read(app, cookie);

    await app.request(`${BASE}/api/profiles/${before?.id ?? ''}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({
        name: 'Marques',
        colour: '#3a8ee8',
        avatar: { kind: 'drawn', style: 'bottts', seed: 'abc' },
      }),
    });

    expect((await read(app, cookie))[0]?.updatedAt).not.toBe(before?.updatedAt);
  });

  it('will not change a profile belonging to somebody else', async () => {
    const { app, profiles } = build();
    const cookie = await signedIn(app);
    const theirs = await profiles.create('another-account', { name: 'Sam', colour: '#3ac47d' });

    const response = await app.request(`${BASE}/api/profiles/${theirs.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ name: 'Mine now', colour: '#3ac47d' }),
    });

    expect(response.status).toBe(404);
  });

  it('removes somebody from the account', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await read(app, cookie);
    await app.request(`${BASE}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ name: 'Sam', colour: '#3ac47d' }),
    });

    const [, sam] = await read(app, cookie);

    const response = await app.request(`${BASE}/api/profiles/${sam?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(await read(app, cookie)).toHaveLength(1);
  });

  it('will not remove the last profile, which would leave nowhere to record viewing', async () => {
    const { app } = build();
    const cookie = await signedIn(app);
    const [only] = await read(app, cookie);

    const response = await app.request(`${BASE}/api/profiles/${only?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).not.toBe(204);
    expect(await read(app, cookie)).toHaveLength(1);
  });

  it('says who could sign in, before anybody has', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await read(app, cookie);

    const response = await app.request(`${BASE}/api/profiles/everyone`);
    const body = ProfileListSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.profiles).toHaveLength(1);
  });

  it('never says an address to somebody who has not signed in', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await read(app, cookie);

    const body = await (await app.request(`${BASE}/api/profiles/everyone`)).text();

    expect(body).not.toContain('marques@flux.local');
  });

  it('serves a drawn face as a picture', async () => {
    const { app } = build();
    const cookie = await signedIn(app);
    const [profile] = await read(app, cookie);

    await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({
        name: 'Marques',
        colour: '#3a8ee8',
        avatar: { kind: 'drawn', style: 'bottts', seed: 'abc' },
      }),
    });

    const response = await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}/avatar`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('svg');
  });

  it('remembers a versioned picture for a long time, since its address changes with it', async () => {
    const { app } = build();
    const cookie = await signedIn(app);
    const [profile] = await read(app, cookie);

    await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({
        name: 'Marques',
        colour: '#3a8ee8',
        avatar: { kind: 'drawn', style: 'bottts', seed: 'abc' },
      }),
    });

    const response = await app.request(
      `${BASE}/api/profiles/${profile?.id ?? ''}/avatar?v=anything`,
    );

    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('signs somebody in by the face they picked', async () => {
    const { app, profiles } = build();
    const cookie = await signedIn(app);
    const [profile] = await read(app, cookie);

    named(profiles, profile?.id ?? '');

    const response = await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ password: CREDENTIALS.password }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(' ')).toContain('session_token');
  });

  it('refuses the wrong password', async () => {
    const { app, profiles } = build();
    const cookie = await signedIn(app);
    const [profile] = await read(app, cookie);

    named(profiles, profile?.id ?? '');

    const response = await app.request(`${BASE}/api/profiles/${profile?.id ?? ''}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ password: 'not the password' }),
    });

    expect(response.status).not.toBe(200);
  });

  it('refuses a face that does not exist', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/profiles/00000000-0000-4000-8000-000000000000/sign-in`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE },
        body: JSON.stringify({ password: CREDENTIALS.password }),
      },
    );

    expect(response.status).toBe(404);
  });
});

describe('giving a profile an account of its own', () => {
  const PROFILE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  const asAdmin = async (context: ReturnType<typeof build>) => {
    const cookie = await signedIn(context.app);
    const user = context.store.user[0];

    if (user !== undefined) {
      user.role = 'admin';

      await makeAdministrator(context.permissions, user.id);
    }

    return cookie;
  };

  const promote = (context: ReturnType<typeof build>, cookie: string, profileId = PROFILE_ID) =>
    context.app.request(`${BASE}/api/admin/profiles/${profileId}/promote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ email: 'dan@flux.local', password: 'a-long-enough-password' }),
    });

  it('hands back the profile once it has an account', async () => {
    const profile: ViewerProfile = {
      id: PROFILE_ID,
      name: 'Dan',
      colour: '#e8a33a',
      avatar: { kind: 'initial' },
      askStillWatchingAfter: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const context = build(() => Promise.resolve({ kind: 'promoted', profile }));
    const cookie = await asAdmin(context);

    const response = await promote(context, cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Dan' });
  });

  it('refuses an address somebody already signs in with', async () => {
    const context = build(() => Promise.resolve({ kind: 'taken' }));
    const cookie = await asAdmin(context);

    expect((await promote(context, cookie)).status).toBe(409);
  });

  it('has nothing to promote when the profile has gone', async () => {
    const context = build(() => Promise.resolve({ kind: 'missing' }));
    const cookie = await asAdmin(context);

    expect((await promote(context, cookie)).status).toBe(404);
  });

  it('has nothing to promote on a server that cannot make accounts', async () => {
    const context = build();
    const cookie = await asAdmin(context);

    expect((await promote(context, cookie)).status).toBe(404);
  });

  it('is for somebody who administers accounts', async () => {
    const context = build(() => Promise.resolve({ kind: 'taken' }));
    const cookie = await signedIn(context.app);

    expect((await promote(context, cookie)).status).toBe(403);
  });
});

describe('a server built without profiles at all', () => {
  /**
   * The application with no profile service behind it.
   */
  const withoutProfiles = () => {
    const { auth, settings } = createMemoryAuth();

    return createApp({
      auth,
      settings,
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
  };

  const PROFILE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  const asks: [string, string, object?][] = [
    ['GET', '/api/profiles'],
    ['POST', '/api/profiles', { name: 'Dan', colour: '#e8a33a' }],
    ['PATCH', `/api/profiles/${PROFILE_ID}`, { name: 'Dan', colour: '#e8a33a' }],
    ['DELETE', `/api/profiles/${PROFILE_ID}`],
  ];

  for (const [method, path, body] of asks) {
    it(`answers ${method} ${path} as though nobody is signed in`, async () => {
      const app = withoutProfiles();
      const cookie = await signedIn(app);

      const response = await app.request(`${BASE}${path}`, {
        method,
        headers: {
          cookie,
          origin: BASE,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      expect(response.status).toBe(401);
    });
  }
});

describe('the pictures and the sign-in list', () => {
  const PROFILE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('draws a face in a style anybody can ask for', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/avatars/thumbs?seed=dan`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
  });

  it('draws the same face every time when no seed is named', async () => {
    const context = build();

    const first = await context.app.request(`${BASE}/api/profiles/avatars/thumbs`);
    const second = await context.app.request(`${BASE}/api/profiles/avatars/thumbs`);

    expect(await first.text()).toBe(await second.text());
  });

  it('has no face in a style it does not draw', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/avatars/oil-painting`);

    expect(response.status).toBe(404);
  });

  it('has no picture for a profile that has never been given one', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/${PROFILE_ID}/avatar`);

    expect(response.status).toBe(404);
  });

  it('says who could sign in, which is nobody on a fresh server', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/everyone`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profiles: [] });
  });

  it('will not sign anybody in without a password', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/${PROFILE_ID}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('will not sign anybody in from a request carrying nothing at all', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/${PROFILE_ID}/sign-in`, {
      method: 'POST',
      headers: { origin: BASE },
    });

    expect(response.status).toBe(400);
  });

  it('has nobody to sign in for a profile that does not exist', async () => {
    const context = build();

    const response = await context.app.request(`${BASE}/api/profiles/${PROFILE_ID}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ password: 'a-long-enough-password' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('giving a profile a picture of its own', () => {
  const signedInWithAProfile = async () => {
    const context = build();
    const cookie = await signedIn(context.app);

    const listed = await context.app.request(`${BASE}/api/profiles`, {
      headers: { cookie, origin: BASE },
    });

    const { profiles } = z
      .object({ profiles: z.array(z.object({ id: z.string() })) })
      .parse(await listed.json());

    return { context, cookie, profileId: profiles[0]?.id ?? '' };
  };

  it('keeps a picture somebody uploaded for their own profile', async () => {
    const { context, cookie, profileId } = await signedInWithAProfile();

    const response = await context.app.request(`${BASE}/api/profiles/${profileId}/photo`, {
      method: 'PUT',
      headers: { cookie, origin: BASE, 'content-type': 'image/webp' },
      body: new Uint8Array([1, 2, 3]),
    });

    expect(response.status).toBe(204);
  });

  it('serves that picture back', async () => {
    const { context, cookie, profileId } = await signedInWithAProfile();

    await context.app.request(`${BASE}/api/profiles/${profileId}/photo`, {
      method: 'PUT',
      headers: { cookie, origin: BASE, 'content-type': 'image/webp' },
      body: new Uint8Array([1, 2, 3]),
    });

    const response = await context.app.request(`${BASE}/api/profiles/${profileId}/avatar?v=2`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('refuses a picture for somebody else’s profile', async () => {
    const { context, cookie } = await signedInWithAProfile();

    const response = await context.app.request(
      `${BASE}/api/profiles/3f2504e0-4f89-41d3-9a0c-0305e82c3301/photo`,
      {
        method: 'PUT',
        headers: { cookie, origin: BASE, 'content-type': 'image/webp' },
        body: new Uint8Array([1, 2, 3]),
      },
    );

    expect(response.status).toBe(400);
  });

  it('turns away nobody trying to upload a picture', async () => {
    const context = build();

    const response = await context.app.request(
      `${BASE}/api/profiles/3f2504e0-4f89-41d3-9a0c-0305e82c3301/photo`,
      { method: 'PUT', headers: { origin: BASE, 'content-type': 'image/webp' } },
    );

    expect(response.status).toBe(401);
  });
});
