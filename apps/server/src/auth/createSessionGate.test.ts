import { describe, expect, it } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryProfileService } from '@ValenceServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const held = { auth, settings, store, permissions };

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService({
      libraries: [
        {
          id: LIBRARY_ID,
          name: 'Films',
          kind: 'movies',
          path: '/media/films',
          itemCount: 0,
          lastScannedAt: null,
          defaultAudioLanguage: null,
          filesAtOnce: null,
        },
      ],
      media: [],
    }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    profiles: createMemoryProfileService(),
  });

  return { ...held, app };
};

const GUARDED: readonly { method: string; path: string }[] = [
  { method: 'GET', path: '/api/libraries' },
  { method: 'POST', path: '/api/libraries' },
  { method: 'PATCH', path: `/api/libraries/${LIBRARY_ID}` },
  { method: 'POST', path: `/api/libraries/${LIBRARY_ID}/scan` },
  { method: 'POST', path: `/api/libraries/${LIBRARY_ID}/reset` },
  { method: 'POST', path: `/api/libraries/${LIBRARY_ID}/regenerate-previews` },
  { method: 'GET', path: `/api/libraries/${LIBRARY_ID}/items` },
  { method: 'GET', path: `/api/libraries/${LIBRARY_ID}/shows` },
  { method: 'GET', path: `/api/media/${MEDIA_ID}` },
  { method: 'GET', path: `/api/media/${MEDIA_ID}/subtitles` },
  { method: 'GET', path: `/api/media/${MEDIA_ID}/image/poster` },
  { method: 'GET', path: `/api/media/${MEDIA_ID}/segments` },
  { method: 'GET', path: `/api/playback/${MEDIA_ID}/file` },
  { method: 'GET', path: `/api/playback/${MEDIA_ID}/trickplay` },
  { method: 'POST', path: `/api/playback/${MEDIA_ID}/session` },
  { method: 'POST', path: `/api/playback/${MEDIA_ID}/explain` },
  { method: 'GET', path: '/api/progress' },
  { method: 'GET', path: '/api/favourites' },
  { method: 'GET', path: '/api/profiles' },
  { method: 'GET', path: '/api/devices' },
  { method: 'GET', path: '/api/admin/overview' },
  { method: 'GET', path: '/api/admin/sessions' },
  { method: 'GET', path: '/api/admin/monitor' },
];

const PUBLIC = [
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/setup/status' },
  { method: 'GET', path: '/api/openapi.json' },
];

describe('the session gate', () => {
  it.each(GUARDED)('turns an anonymous $method $path away', async ({ method, path }) => {
    const { app } = build();

    const response = await app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(401);
  });

  it.each(PUBLIC)('answers an anonymous $method $path', async ({ method, path }) => {
    const { app } = build();

    const response = await app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).not.toBe(401);
  });

  describe('who lives here', () => {
    it('is kept from somebody who has not signed in', async () => {
      const { app } = build();

      const response = await app.request(`${TEST_ORIGIN}/api/profiles/everyone`, {
        headers: { origin: TEST_ORIGIN },
      });

      expect(response.status).toBe(401);
    });

    it('is shown where the server is set to show it', async () => {
      const { app, settings } = build();

      await settings.write({ showsProfilesBeforeSignIn: true });

      const response = await app.request(`${TEST_ORIGIN}/api/profiles/everyone`, {
        headers: { origin: TEST_ORIGIN },
      });

      expect(response.status).not.toBe(401);
    });

    it('is shut again the moment the setting is turned off, without a restart', async () => {
      const { app, settings } = build();

      await settings.write({ showsProfilesBeforeSignIn: true });
      await settings.write({ showsProfilesBeforeSignIn: false });

      const response = await app.request(`${TEST_ORIGIN}/api/profiles/everyone`, {
        headers: { origin: TEST_ORIGIN },
      });

      expect(response.status).toBe(401);
    });

    it('is read by somebody signed in either way', async () => {
      const { app } = build();
      const cookie = await signUpForTest(app);

      const response = await app.request(`${TEST_ORIGIN}/api/profiles/everyone`, {
        headers: { cookie, origin: TEST_ORIGIN },
      });

      expect(response.status).toBe(200);
    });
  });

  it('streams nothing to somebody who never signed in', async () => {
    const { app } = build();

    const response = await app.request(`${TEST_ORIGIN}/api/playback/${MEDIA_ID}/file`, {
      headers: { range: 'bytes=0-1023' },
    });

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('WEBVTT');
  });

  it('lets somebody signed in read the catalogue', async () => {
    const { app } = build();
    const cookie = await signUpForTest(app);

    const response = await app.request(`${TEST_ORIGIN}/api/libraries`, {
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(200);
  });

  it('still keeps an ordinary account out of the administrator routes', async () => {
    const { app } = build();
    const cookie = await signUpForTest(app);

    const response = await app.request(`${TEST_ORIGIN}/api/admin/overview`, {
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(403);
  });

  describe('the routes that reshape a library', () => {
    it.each([
      { path: `/api/libraries/${LIBRARY_ID}/scan` },
      { path: `/api/libraries/${LIBRARY_ID}/reset` },
      { path: `/api/libraries/${LIBRARY_ID}/regenerate-previews` },
    ])('refuses $path to an account that is merely signed in', async ({ path }) => {
      const { app } = build();
      const cookie = await signUpForTest(app);

      const response = await app.request(`${TEST_ORIGIN}${path}`, {
        method: 'POST',
        headers: { cookie, origin: TEST_ORIGIN },
      });

      expect(response.status).toBe(403);
    });

    it('refuses to add a library for an account that is merely signed in', async () => {
      const { app } = build();
      const cookie = await signUpForTest(app);

      const response = await app.request(`${TEST_ORIGIN}/api/libraries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: TEST_ORIGIN },
        body: JSON.stringify({ name: 'Anything', kind: 'movies', path: '/tmp' }),
      });

      expect(response.status).toBe(403);
    });

    it('lets an administrator through', async () => {
      const { app, store, permissions } = build();
      const cookie = await signUpForTest(app);
      const account = store.user[0];

      if (account !== undefined) {
        await makeAdministrator(permissions, account.id);
      }

      const response = await app.request(`${TEST_ORIGIN}/api/libraries/${LIBRARY_ID}/scan`, {
        method: 'POST',
        headers: { cookie, origin: TEST_ORIGIN },
      });

      expect(response.status).toBe(202);
    });
  });
});
