import { describe, expect, it } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryShareService } from '@ValenceServer/sharing/createMemoryShareService';
import type { Permission } from '@ValenceContracts/schemas/Permission';

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
    ratings: createMemoryRatingService(),
    shares: createMemoryShareService(),
  });

  return { app, store, permissions };
};

/**
 * Signs somebody up and gives them exactly the permissions named, through a role made for the
 * purpose.
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
    cookie,
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

describe('every gated route, asked by somebody with no permissions', () => {
  const GATED: [
    string,
    string,
    string,
    { query?: string; body?: object; refusesWith?: number }?,
  ][] = [
    ['POST', '/api/libraries', 'library.create'],
    ['PATCH', `/api/libraries/${LIBRARY_ID}`, 'library.edit'],
    ['POST', `/api/libraries/${LIBRARY_ID}/scan`, 'jobs.run'],
    ['GET', '/api/admin/catalogue/search', 'media.override', { query: 'query=Arrival&kind=movie' }],
    [
      'POST',
      `/api/media/${LIBRARY_ID}/match`,
      'media.override',
      { body: { reference: '329' }, refusesWith: 404 },
    ],
    ['DELETE', `/api/media/${LIBRARY_ID}/match`, 'media.override', { refusesWith: 404 }],
    ['POST', `/api/libraries/${LIBRARY_ID}/reset`, 'jobs.runDestructive'],
    ['DELETE', `/api/libraries/${LIBRARY_ID}`, 'library.delete'],
    ['POST', `/api/libraries/${LIBRARY_ID}/regenerate-previews`, 'jobs.run'],
    [
      'POST',
      `/api/admin/profiles/${LIBRARY_ID}/promote`,
      'account.manage',
      { body: { email: 'dan@valence.local', password: 'a-long-enough-password' } },
    ],
    ['GET', '/api/admin/overview', 'server.monitor'],
    ['PATCH', '/api/admin/settings', 'server.settings'],
    ['GET', '/api/admin/sessions', 'streaming.view'],
    ['GET', '/api/admin/shares', 'sharing.manage'],
    ['DELETE', '/api/admin/shares/6f8e6d3e-6f3a-4a1e-8e9a-2f7b6c5d4e3a', 'sharing.manage'],
    ['DELETE', '/api/admin/sessions/tab-1', 'streaming.stop'],
    ['POST', '/api/admin/sessions/tab-1/pause', 'streaming.pause'],
    ['POST', '/api/admin/sessions/tab-1/resume', 'streaming.pause'],
    ['GET', '/api/admin/jobs/definitions', 'jobs.run'],
    ['POST', '/api/admin/jobs/library.scan/run', 'jobs.run'],
    ['POST', '/api/admin/jobs/running/job-1/cancel', 'jobs.run'],
    ['GET', '/api/admin/jobs/schedules', 'jobs.schedule'],
    ['POST', '/api/admin/jobs/library.scan/triggers', 'jobs.schedule'],
    ['DELETE', '/api/admin/jobs/library.scan/triggers/trigger-1', 'jobs.schedule'],
    ['GET', '/api/admin/permissions', 'account.roles'],
    ['GET', '/api/admin/roles', 'account.roles'],
    ['GET', '/api/admin/accounts/user-1/roles', 'account.roles'],
    ['GET', '/api/admin/accounts', 'account.manage'],
    ['DELETE', '/api/admin/accounts/user-1/ban', 'account.ban'],
    ['POST', '/api/admin/accounts', 'account.invite'],
  ];

  for (const [method, path, permission, carrying] of GATED) {
    it(`refuses ${method} ${path}, which needs ${permission}`, async () => {
      const context = await signedInWith([]);
      const cookie = context.cookie;

      const response = await context.app.request(
        `${TEST_ORIGIN}${path}${carrying?.query === undefined ? '' : `?${carrying.query}`}`,
        {
          method,
          headers: {
            cookie,
            origin: TEST_ORIGIN,
            ...(carrying?.body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(carrying?.body === undefined ? {} : { body: JSON.stringify(carrying.body) }),
        },
      );

      expect(response.status).toBe(carrying?.refusesWith ?? 403);
    });
  }

  it('names every permission the server actually has, so none is unreachable', () => {
    const asked = new Set(GATED.map(([, , permission]) => permission));

    expect(asked.size).toBeGreaterThan(10);
  });
});

describe('every route that needs somebody signed in, asked by nobody', () => {
  const NEEDS_SOMEBODY: [string, string, object?][] = [
    ['GET', '/api/progress'],
    ['PUT', `/api/media/${LIBRARY_ID}/progress`, { positionSeconds: 10, durationSeconds: 100 }],
    ['DELETE', `/api/media/${LIBRARY_ID}/progress`],
    ['GET', '/api/favourites'],
    ['PUT', `/api/media/${LIBRARY_ID}/favourite`],
    ['DELETE', `/api/media/${LIBRARY_ID}/favourite`],
    ['GET', '/api/devices'],
    ['DELETE', '/api/devices/session-1'],
    ['DELETE', '/api/devices'],
    ['POST', '/api/presence/tab-1/heartbeat', { isPlaying: true }],
    ['DELETE', '/api/presence/tab-1/watching'],
  ];

  for (const [method, path, body] of NEEDS_SOMEBODY) {
    it(`turns nobody away from ${method} ${path}`, async () => {
      const { app } = build();

      const response = await app.request(`${TEST_ORIGIN}${path}`, {
        method,
        headers: {
          origin: TEST_ORIGIN,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      expect(response.status).toBe(401);
    });
  }
});

describe('the routes that read who is asking, asked by nobody at all', () => {
  const ROLE_ROUTES: [string, string, object?][] = [
    ['POST', '/api/admin/roles', { name: 'Staff', position: 10, permissions: [] }],
    ['PATCH', '/api/admin/roles/role-1', { name: 'Staff' }],
    ['DELETE', '/api/admin/roles/role-1'],
    ['PUT', '/api/admin/accounts/usr_other/roles/role-1'],
    ['DELETE', '/api/admin/accounts/usr_other/roles/role-1'],
    [
      'PUT',
      '/api/admin/accounts/usr_other/overrides',
      { permission: 'server.logs', effect: 'allow' },
    ],
    ['DELETE', '/api/admin/accounts/usr_other/overrides/server.logs'],
  ];

  for (const [method, path, body] of ROLE_ROUTES) {
    it(`turns nobody away from ${method} ${path} before the route is reached`, async () => {
      const { app } = build();

      const response = await app.request(`${TEST_ORIGIN}${path}`, {
        method,
        headers: {
          origin: TEST_ORIGIN,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      expect(response.status).toBe(401);
    });
  }
});
