import { describe, expect, it } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

/**
 * The server, with everybody who signs up made an administrator.
 *
 * The first account on a self-hosted instance runs it, which is what makes
 * these routes reachable at all.
 */
const build = () => {
  const { auth, settings } = createMemoryAuth();

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    listUsers: () =>
      Promise.resolve([
        {
          id: 'usr_1',
          name: 'Marques',
          email: CREDENTIALS.email,
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    profiles: createMemoryProfileService(),
  });

  return { app, settings };
};

const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

describe('administration over HTTP', () => {
  it('tells somebody who is not signed in nothing about the server', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/overview`);

    expect(response.status).toBe(403);
  });

  it('tells an ordinary account nothing either, whatever its interface hides', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/overview`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('will not let an ordinary account change a setting', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    });

    expect(response.status).toBe(403);
  });

  it('leaves the setting alone when it refuses', async () => {
    const { app, settings } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    });

    expect((await settings.read()).catalogueApiKey).toBe('');
  });

  it('never hands the catalogue key back to a browser', async () => {
    const { app, settings } = build();

    await settings.write({ catalogueApiKey: 'a-secret' });

    const cookie = await signedIn(app);
    const body = await (
      await app.request(`${BASE}/api/admin/overview`, { headers: { cookie, origin: BASE } })
    ).text();

    expect(body).not.toContain('a-secret');
  });
});
