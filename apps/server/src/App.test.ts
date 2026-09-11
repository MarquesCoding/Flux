import { describe, expect, it } from 'vitest';
import { createApp } from './App';
import { createMemoryAuth } from './auth/createMemoryAuth';
import { createMemoryLibraryService } from './library/createMemoryLibraryService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryPlaybackService } from './playback/createMemoryPlaybackService';
import { createMemoryPermissionService } from './auth/createMemoryPermissionService';
import { signedInApp, TEST_ORIGIN } from './auth/signUpForTest';
import { z } from 'zod';
import type { RunningJob } from './jobs/JobQueue';

const RolesSchema = z.object({
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
});

const { auth, settings } = createMemoryAuth();
const app = createApp({
  auth,
  settings,
  countUsers: () => Promise.resolve(1),
  promoteToAdmin: () => Promise.resolve(),
  library: createMemoryLibraryService(),
  subtitles: createMemorySubtitleService(),
  segments: createMemorySegmentService(),
  progress: createMemoryWatchProgressService(),
  favourites: createMemoryFavouriteService(),
  ratings: createMemoryRatingService(),
  playback: createMemoryPlaybackService(),
});

describe('createApp', () => {
  it('reports degraded when the media service cannot be reached', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      transcoderReachable: false,
    });
  });

  it('reports ok when the media service answers', async () => {
    const { auth, settings } = createMemoryAuth();
    const healthy = createApp({
      auth,
      settings,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService(),
      subtitles: createMemorySubtitleService(),
      segments: createMemorySegmentService(),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      playback: createMemoryPlaybackService(),
      isTranscoderReachable: () => Promise.resolve(true),
    });

    const response = await healthy.request('/api/health');

    expect(await response.json()).toMatchObject({ status: 'ok', transcoderReachable: true });
  });

  it('serves an OpenAPI 3.1 document', async () => {
    const response = await app.request('/api/openapi.json');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ openapi: '3.1.0', info: { title: 'Valence API' } });
  });

  it('documents the playback endpoints in the specification', async () => {
    const response = await app.request('/api/openapi.json');
    const body = await response.json();

    expect(body).toHaveProperty(['paths', '/api/playback/{mediaId}/session', 'post']);
    expect(body).toHaveProperty(['paths', '/api/playback/{mediaId}/explain', 'post']);
  });

  it('serves the Scalar API reference', async () => {
    const response = await app.request('/api/reference');

    expect(response.status).toBe(200);
  });
});

describe('what the server says it is working on', () => {
  const build = (running: RunningJob[]) => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
        listRunningJobs: () => running,
      }),
      { store, permissions, isAdministrator: true },
    );
  };

  it('says nothing is running when nothing is', async () => {
    const app = build([]);

    const response = await app.request(`${TEST_ORIGIN}/api/libraries/scans`);

    expect(await response.json()).toEqual({ scans: [] });
  });

  it('reports how far a job has got when it has said', async () => {
    const app = build([
      {
        jobId: 'job-1',
        kind: 'library.scan',
        subject: 'library-1',
        progress: { phase: 'probing', processed: 3, total: 10 },
      },
    ]);

    const response = await app.request(`${TEST_ORIGIN}/api/libraries/scans`);

    expect(await response.json()).toMatchObject({
      scans: [
        { jobId: 'job-1', libraryId: 'library-1', phase: 'probing', processed: 3, total: 10 },
      ],
    });
  });

  it('reports a job that has not said anything about itself yet', async () => {
    const app = build([{ jobId: 'job-1', kind: 'library.scan', subject: null, progress: null }]);

    const response = await app.request(`${TEST_ORIGIN}/api/libraries/scans`);

    expect(await response.json()).toMatchObject({
      scans: [{ jobId: 'job-1', libraryId: null, phase: null, processed: null, total: null }],
    });
  });
});

describe('the session gate standing in front of every private route', () => {
  const anonymous = () => {
    const { auth, settings } = createMemoryAuth();

    return createApp({
      auth,
      settings,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService(),
      subtitles: createMemorySubtitleService(),
      segments: createMemorySegmentService(),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      playback: createMemoryPlaybackService(),
      permissions: createMemoryPermissionService(),
    });
  };

  const GUARDED = [
    ['GET', '/api/keys'],
    ['POST', '/api/keys'],
    ['PATCH', '/api/keys/abc'],
    ['DELETE', '/api/keys/abc'],
    ['GET', '/api/notifications'],
    ['POST', '/api/notifications/read'],
    ['GET', '/api/notifications/preferences'],
    ['PUT', '/api/notifications/preferences'],
    ['POST', '/api/notifications/push'],
    ['DELETE', '/api/notifications/push'],
    ['GET', '/api/account/devices'],
    ['DELETE', '/api/account/devices/abc'],
    ['POST', '/api/account/devices/end-others'],
    ['GET', '/api/shares'],
    ['POST', '/api/shares'],
    ['DELETE', '/api/shares/abc'],
    ['GET', '/api/admin/shares'],
    ['DELETE', '/api/admin/shares/abc'],
    ['DELETE', '/api/admin/jobs/library.scan/triggers/abc'],
  ] as const;

  it.each(GUARDED)('answers 401 to %s %s', async (method, path) => {
    const response = await anonymous().request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify({}) }),
    });

    expect(response.status).toBe(401);
  });
});

describe('the routes that need a profile chosen, not merely an account signed in', () => {
  const signedInWithNoProfileChosen = () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions, isAdministrator: true },
    );
  };

  const MEDIA = '9c858901-8a57-4791-81fe-4c455b099bc9';
  const SERIES = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  const NEEDS_A_PROFILE = [
    ['GET', '/api/progress'],
    ['DELETE', `/api/media/${MEDIA}/progress`],
    ['GET', '/api/history'],
    ['DELETE', '/api/history'],
    ['DELETE', `/api/history/${MEDIA}`],
    ['GET', '/api/people/1'],
    ['GET', '/api/people/1/credits'],
    ['GET', '/api/favourites'],
    ['PUT', `/api/media/${MEDIA}/favourite`],
    ['DELETE', `/api/media/${MEDIA}/favourite`],
    ['GET', '/api/ratings'],
    ['PUT', `/api/media/${MEDIA}/rating`],
    ['DELETE', `/api/media/${MEDIA}/rating`],
    ['GET', `/api/media/${MEDIA}/rating/household`],
    ['PUT', `/api/series/${SERIES}/rating`],
    ['DELETE', `/api/series/${SERIES}/rating`],
    ['GET', `/api/series/${SERIES}/rating/household`],
  ] as const;

  it.each(NEEDS_A_PROFILE)('refuses %s %s until somebody is watching', async (method, path) => {
    const response = await signedInWithNoProfileChosen().request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      ...(method === 'GET' || method === 'DELETE'
        ? {}
        : { body: JSON.stringify({ positionSeconds: 1, stars: 3 }) }),
    });

    expect(response.status).toBe(401);
  });
});

describe('what an ordinary account may not do to roles or webhooks', () => {
  const anOrdinaryAccount = () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions },
    );
  };

  const ACCOUNT = '00000000-0000-4000-8000-000000000001';
  const ROLE = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  const FOR_AN_ADMINISTRATOR = [
    ['DELETE', `/api/webhooks/${ROLE}`],
    ['POST', `/api/webhooks/${ROLE}/test`],
    ['PATCH', `/api/admin/roles/${ROLE}`],
    ['DELETE', `/api/admin/roles/${ROLE}`],
    ['PUT', `/api/admin/accounts/${ACCOUNT}/roles/${ROLE}`],
    ['DELETE', `/api/admin/accounts/${ACCOUNT}/roles/${ROLE}`],
  ] as const;

  it.each(FOR_AN_ADMINISTRATOR)('refuses %s %s', async (method, path) => {
    const response = await anOrdinaryAccount().request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      ...(method === 'DELETE'
        ? {}
        : { body: JSON.stringify({ name: 'Guests', permissions: [], granted: [], revoked: [] }) }),
    });

    expect(response.status).toBe(403);
  });
});

describe('an instance built without the services a route needs', () => {
  const withoutExtras = () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions, isAdministrator: true },
    );
  };

  it('says there is no such profile rather than failing, where profiles are not held', async () => {
    const response = await withoutExtras().request(
      `${TEST_ORIGIN}/api/profiles/00000000-0000-4000-8000-000000000001/sign-in`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
        body: '{}',
      },
    );

    expect(response.status).toBe(404);
  });

  it('reports an empty log rather than an error, where logs are not kept', async () => {
    const response = await withoutExtras().request(`${TEST_ORIGIN}/api/admin/logs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ records: [], total: 0 });
  });

  it('says a share link does not work, where sharing is not set up', async () => {
    const response = await withoutExtras().request(`${TEST_ORIGIN}/api/share/a-token`);

    expect(response.status).toBe(404);
  });

  it.each([
    ['GET', '/api/shares'],
    ['POST', '/api/shares'],
    ['GET', '/api/admin/shares'],
    ['DELETE', '/api/shares/3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
    ['DELETE', '/api/admin/shares/3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
  ] as const)('refuses %s %s where sharing is not set up', async (method, path) => {
    const response = await withoutExtras().request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      ...(method === 'GET' || method === 'DELETE'
        ? {}
        : {
            body: JSON.stringify({ kind: 'item', mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9' }),
          }),
    });

    expect(response.status).toBe(401);
  });
});

describe('managing roles as an administrator', () => {
  const asAnAdministrator = () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions, isAdministrator: true },
    );
  };

  const NOWHERE = '00000000-0000-4000-8000-0000000000ff';
  const ACCOUNT = '00000000-0000-4000-8000-000000000001';

  it('says there is no such role when asked to change one that is not there', async () => {
    const response = await asAnAdministrator().request(
      `${TEST_ORIGIN}/api/admin/roles/${NOWHERE}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
        body: JSON.stringify({ name: 'Guests' }),
      },
    );

    expect(response.status).toBe(404);
  });

  it('says there is no such role when asked to delete one that is not there', async () => {
    const response = await asAnAdministrator().request(
      `${TEST_ORIGIN}/api/admin/roles/${NOWHERE}`,
      {
        method: 'DELETE',
        headers: { origin: TEST_ORIGIN },
      },
    );

    expect(response.status).toBe(404);
  });

  it('says there is no such role when asked to give one out', async () => {
    const response = await asAnAdministrator().request(
      `${TEST_ORIGIN}/api/admin/accounts/${ACCOUNT}/roles/${NOWHERE}`,
      { method: 'PUT', headers: { origin: TEST_ORIGIN } },
    );

    expect(response.status).toBe(404);
  });

  it('takes away a role somebody never held without complaining', async () => {
    const response = await asAnAdministrator().request(
      `${TEST_ORIGIN}/api/admin/accounts/${ACCOUNT}/roles/${NOWHERE}`,
      { method: 'DELETE', headers: { origin: TEST_ORIGIN } },
    );

    expect(response.status).toBe(204);
  });

  it('refuses to delete the role that grants administrator', async () => {
    const app = asAnAdministrator();
    const listed = await app.request(`${TEST_ORIGIN}/api/admin/roles`);
    const roles = RolesSchema.parse(await listed.json());
    const administrator = roles.roles.find((role) => role.name === 'Administrator');

    const response = await app.request(
      `${TEST_ORIGIN}/api/admin/roles/${administrator?.id ?? ''}`,
      { method: 'DELETE', headers: { origin: TEST_ORIGIN } },
    );

    expect(response.status).toBe(400);
  });
});

describe('deleting a library', () => {
  const FILMS_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  const build = () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    return signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService({
          libraries: [
            {
              id: FILMS_ID,
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
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions, isAdministrator: true },
    );
  };

  const remove = (app: ReturnType<typeof build>) =>
    app.request(`${TEST_ORIGIN}/api/libraries/${FILMS_ID}`, {
      method: 'DELETE',
      headers: { origin: TEST_ORIGIN },
    });

  it('forgets the library, so it is no longer listed', async () => {
    const app = build();

    expect((await remove(app)).status).toBe(204);

    const listed = await app.request(`${TEST_ORIGIN}/api/libraries`);

    expect(await listed.json()).toEqual([]);
  });

  it('says there is no such library once it has gone', async () => {
    const app = build();

    await remove(app);

    expect((await remove(app)).status).toBe(404);
  });
});
