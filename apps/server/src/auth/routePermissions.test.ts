import { describe, expect, it } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signUpForTest, TEST_ORIGIN } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import type { Permission } from '@FluxContracts/schemas/Permission';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();

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
  });

  return { app, store, permissions };
};

/**
 * Signs somebody up and gives them exactly the permissions named, through a
 * role made for the purpose.
 *
 * Exactly, because the point of these tests is what a permission does and does
 * not open — a helper that quietly granted anything else would prove nothing.
 */
const signedInWith = async (permissionNames: readonly Permission[]) => {
  const context = build();
  const cookie = await signUpForTest(context.app);
  const account = context.store.user[0];

  const role = await context.permissions.createRole({
    name: 'Purpose-made',
    position: 50,
    permissions: [...permissionNames],
  });

  if (account !== undefined) {
    await context.permissions.assignRole(account.id, role.id);
  }

  return {
    ...context,
    request: (path: string, method = 'POST') =>
      context.app.request(`${TEST_ORIGIN}${path}`, {
        method,
        headers: { cookie, origin: TEST_ORIGIN },
      }),
  };
};

const SCAN = `/api/libraries/${LIBRARY_ID}/scan`;
const RESET = `/api/libraries/${LIBRARY_ID}/reset`;

describe('what a route actually requires', () => {
  describe('running jobs against a library', () => {
    it('lets somebody with jobs.run scan', async () => {
      const context = await signedInWith(['jobs.run']);

      expect((await context.request(SCAN)).status).toBe(202);
    });

    it('does not let jobs.run reset and rebuild', async () => {
      const context = await signedInWith(['jobs.run']);

      expect((await context.request(RESET)).status).toBe(403);
    });

    it('lets somebody with jobs.runDestructive reset', async () => {
      const context = await signedInWith(['jobs.runDestructive']);

      expect((await context.request(RESET)).status).toBe(202);
    });

    it('does not let jobs.runDestructive stand in for an ordinary scan', async () => {
      const context = await signedInWith(['jobs.runDestructive']);

      expect((await context.request(SCAN)).status).toBe(403);
    });
  });

  describe('the separation this exists for', () => {
    it('lets a library be scanned by somebody who cannot wipe it', async () => {
      const context = await signedInWith(['jobs.run', 'library.edit']);

      expect((await context.request(SCAN)).status).toBe(202);
      expect((await context.request(RESET)).status).toBe(403);
    });

    it('lets somebody watch streams without being able to change the server', async () => {
      const context = await signedInWith(['streaming.view']);

      expect((await context.request('/api/admin/sessions', 'GET')).status).toBe(200);
      expect((await context.request('/api/admin/settings', 'PATCH')).status).toBe(403);
    });

    it('does not let looking at streams stop one', async () => {
      const context = await signedInWith(['streaming.view']);

      expect((await context.request('/api/admin/sessions/abc', 'DELETE')).status).toBe(403);
    });

    it('lets somebody with streaming.stop reach that route', async () => {
      const context = await signedInWith(['streaming.stop']);

      expect((await context.request('/api/admin/sessions/abc', 'DELETE')).status).not.toBe(403);
    });

    it('separates scheduling a job from running one', async () => {
      const context = await signedInWith(['jobs.schedule']);

      expect((await context.request('/api/admin/jobs/schedules', 'GET')).status).toBe(200);
      expect((await context.request(SCAN)).status).toBe(403);
    });
  });

  describe('an account with nothing', () => {
    it('is turned away from every one of them', async () => {
      const context = await signedInWith([]);

      for (const [path, method] of [
        [SCAN, 'POST'],
        [RESET, 'POST'],
        ['/api/libraries', 'POST'],
        ['/api/admin/overview', 'GET'],
        ['/api/admin/sessions', 'GET'],
        ['/api/admin/monitor', 'GET'],
        ['/api/admin/jobs/schedules', 'GET'],
      ] as const) {
        expect((await context.request(path, method)).status).toBe(403);
      }
    });

    it('can still watch, which is the point of having an account', async () => {
      const context = await signedInWith([]);

      expect((await context.request('/api/libraries', 'GET')).status).toBe(200);
    });
  });

  describe('administrator', () => {
    it('opens everything, including what no role explicitly granted', async () => {
      const context = await signedInWith(['administrator']);

      expect((await context.request(SCAN)).status).toBe(202);
      expect((await context.request(RESET)).status).toBe(202);
      expect((await context.request('/api/admin/overview', 'GET')).status).toBe(200);
      expect((await context.request('/api/admin/monitor', 'GET')).status).not.toBe(403);
    });
  });
});
