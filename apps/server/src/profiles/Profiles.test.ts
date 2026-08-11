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
import { createMemoryProfileService } from './createMemoryProfileService';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const ProfileListSchema = z.object({
  profiles: z.array(z.object({ id: z.string(), name: z.string(), updatedAt: z.string() })),
});

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const profiles = createMemoryProfileService();

  const app = createApp({
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
    profiles,
  });

  return { app, profiles };
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

    // Only the database knows which address is behind a profile, so the
    // double is told the one this account was made with.
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
