import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createPresenceService } from '@FluxServer/presence/PresenceService';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { Reason } from '@FluxContracts/schemas/PlaybackPlan';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const LIBRARY = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Movies',
  kind: 'movies' as const,
  path: '/media/movies',
  itemCount: 0,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
};

const build = (
  waiting: {
    isTranscoderReachable?: () => Promise<boolean>;
    cancelJob?: (jobId: string) => Promise<boolean>;
  } = {},
) => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const presence = createPresenceService();

  const app = createApp({
    ...(waiting.isTranscoderReachable === undefined
      ? {}
      : { isTranscoderReachable: waiting.isTranscoderReachable }),
    ...(waiting.cancelJob === undefined ? {} : { cancelJob: waiting.cancelJob }),
    auth,
    settings,
    permissions,
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
    library: createMemoryLibraryService({ libraries: [LIBRARY], media: [] }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    profiles: createMemoryProfileService(),
    presence,
  });

  return { app, settings, store, permissions, presence };
};

const signedIn = (app: ReturnType<typeof build>['app']): Promise<string> =>
  signUpForTest(app, CREDENTIALS);

/**
 * Signs up and gives that account the Administrator role.
 */
const signedInAsAdmin = async (
  app: ReturnType<typeof build>['app'],
  store: ReturnType<typeof build>['store'],
  permissions: ReturnType<typeof build>['permissions'],
): Promise<string> => {
  const cookie = await signedIn(app);
  const user = store.user[0];

  if (user !== undefined) {
    user.role = 'admin';

    await makeAdministrator(permissions, user.id);
  }

  return cookie;
};

describe('administration over HTTP', () => {
  it('tells somebody who is not signed in nothing about the server', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/overview`);

    expect(response.status).toBe(401);
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

  it('tells somebody who is not signed in nothing about who is streaming', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/sessions`);

    expect(response.status).toBe(401);
  });

  it('tells an ordinary account nothing about who is streaming either', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/sessions`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('will not let an unauthenticated request stop a session', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/sessions/some-session`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  it('will not let an ordinary account stop a session', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/sessions/some-session`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('will not let an unauthenticated request pause a stream', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/pause`, {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it('will not let an ordinary account pause a stream', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('will not let an unauthenticated request resume a stream', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/resume`, {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it('will not let an ordinary account resume a stream', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/resume`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('tells somebody who is not signed in nothing about the jobs it can run', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`);

    expect(response.status).toBe(401);
  });

  it('will not let an ordinary account list runnable jobs', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('will not let an unauthenticated request start a job', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });

    expect(response.status).toBe(401);
  });

  it('stops a job somebody asked to stop', async () => {
    const cancelJob = vi.fn(() => Promise.resolve(true));
    const { app, store, permissions } = build({ cancelJob });
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/running/job-1/cancel`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(202);
    expect(cancelJob).toHaveBeenCalledWith('job-1');
  });

  it('says so when there is nothing running under that id', async () => {
    const { app, store, permissions } = build({ cancelJob: () => Promise.resolve(false) });
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/running/job-1/cancel`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  it('will not let an ordinary account stop a job', async () => {
    const cancelJob = vi.fn(() => Promise.resolve(true));
    const { app } = build({ cancelJob });
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/jobs/running/job-1/cancel`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
    expect(cancelJob).not.toHaveBeenCalled();
  });

  it('will not run a job kind it does not know', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/not-a-real-kind/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });

    expect(response.status).toBe(404);
  });

  it('will not run a job against a library that does not exist', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: '00000000-0000-0000-0000-000000000000' }),
    });

    expect(response.status).toBe(404);
  });

  it('lists every job an admin can start, with reset and rebuild among them', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`, {
      headers: { cookie, origin: BASE },
    });
    const body = z
      .object({ definitions: z.array(z.object({ kind: z.string() })) })
      .parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.definitions.map((definition) => definition.kind)).toEqual(
      expect.arrayContaining([
        'library.scan',
        'library.regeneratePreviews',
        'library.regenerateTrickplay',
        'library.detectSegments',
        'library.reset',
        'server.cleanupImageCache',
        'server.cleanupSessions',
        'server.checkCatalogueConnectivity',
      ]),
    );
  });

  it('will not run a library-scoped job when no library was given', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(404);
  });

  it('starts a scan for a library an admin picks', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });
    const body = z.object({ jobId: z.string(), state: z.string() }).parse(await response.json());

    expect(response.status).toBe(202);
    expect(body.state).toBe('queued');
  });

  it('runs reset and rebuild through the same generic route', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.reset/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });

    expect(response.status).toBe(202);
  });

  it('starts thumbnail regeneration for a library an admin picks', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.regenerateTrickplay/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });

    expect(response.status).toBe(202);
  });

  it('starts intro and outro detection for a library an admin picks', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.detectSegments/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    });

    expect(response.status).toBe(202);
  });

  it('starts an image cache cleanup with no library at all', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/server.cleanupImageCache/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(202);
  });

  it('starts a session cleanup with no library at all', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/server.cleanupSessions/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(202);
  });

  it('starts a catalogue connectivity check with no library at all', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(
      `${BASE}/api/admin/jobs/server.checkCatalogueConnectivity/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: BASE },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(202);
  });

  it('tells somebody who is not signed in nothing about job schedules', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`);

    expect(response.status).toBe(401);
  });

  it('will not let an ordinary account list job schedules', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('lists every job with no triggers until one is added', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    });
    const body = z
      .object({
        schedules: z.array(z.object({ kind: z.string(), triggers: z.array(z.unknown()) })),
      })
      .parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.schedules.length).toBeGreaterThan(0);
    expect(body.schedules.every((entry) => entry.triggers.length === 0)).toBe(true);
  });

  it('will not let an unauthenticated request add a trigger', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trigger: { kind: 'startup' } }),
    });

    expect(response.status).toBe(401);
  });

  it('will not add a trigger to a job kind it does not know', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/not-a-real-kind/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'startup' } }),
    });

    expect(response.status).toBe(404);
  });

  it('rejects a trigger cron could not express', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'everyMinutes', minutes: 90 } }),
    });

    expect(response.status).toBe(400);
  });

  it('adds a trigger and reflects it back from the list', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const added = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'daily', hour: 3, minute: 0 } }),
    });

    expect(added.status).toBe(201);

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    });
    const body = z
      .object({
        schedules: z.array(
          z.object({
            kind: z.string(),
            triggers: z.array(z.object({ id: z.string(), trigger: z.unknown() })),
          }),
        ),
      })
      .parse(await list.json());

    expect(
      body.schedules.find((entry) => entry.kind === 'library.scan')?.triggers.map((t) => t.trigger),
    ).toEqual([{ kind: 'daily', hour: 3, minute: 0 }]);
  });

  it('keeps several triggers on one job rather than replacing the last', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    for (const trigger of [{ kind: 'daily', hour: 3, minute: 0 }, { kind: 'startup' }]) {
      await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: BASE },
        body: JSON.stringify({ trigger }),
      });
    }

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    });
    const body = z
      .object({
        schedules: z.array(
          z.object({
            kind: z.string(),
            triggers: z.array(
              z.object({ id: z.string(), trigger: z.object({ kind: z.string() }) }),
            ),
          }),
        ),
      })
      .parse(await list.json());

    expect(
      body.schedules
        .find((entry) => entry.kind === 'library.scan')
        ?.triggers.map((t) => t.trigger.kind),
    ).toEqual(['daily', 'startup']);
  });

  it('removes a trigger by its id', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const added = await app.request(`${BASE}/api/admin/jobs/server.cleanupSessions/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'everyHours', hours: 6 } }),
    });
    const { id } = z.object({ id: z.string() }).parse(await added.json());

    const removed = await app.request(
      `${BASE}/api/admin/jobs/server.cleanupSessions/triggers/${id}`,
      { method: 'DELETE', headers: { cookie, origin: BASE } },
    );

    expect(removed.status).toBe(204);

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    });
    const body = z
      .object({
        schedules: z.array(z.object({ kind: z.string(), triggers: z.array(z.unknown()) })),
      })
      .parse(await list.json());

    expect(
      body.schedules.find((entry) => entry.kind === 'server.cleanupSessions')?.triggers,
    ).toEqual([]);
  });

  it('reports no such trigger when removing one that was never there', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(
      `${BASE}/api/admin/jobs/library.scan/triggers/never-existed`,
      { method: 'DELETE', headers: { cookie, origin: BASE } },
    );

    expect(response.status).toBe(404);
  });
});

describe('an admin page while the media service is not answering', () => {
  it('still draws, rather than waiting for ever on a service that never replies', async () => {
    const { app, store, permissions } = build({
      isTranscoderReachable: () => new Promise<boolean>(() => undefined),
    });
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/overview`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
  }, 20_000);

  it('reports the media service as unreachable rather than guessing it is fine', async () => {
    const { app, store, permissions } = build({
      isTranscoderReachable: () => new Promise<boolean>(() => undefined),
    });
    const cookie = await signedInAsAdmin(app, store, permissions);

    const body = await (
      await app.request(`${BASE}/api/admin/overview`, { headers: { cookie, origin: BASE } })
    ).json();

    expect(body).toMatchObject({ transcoder: { isReachable: false } });
  }, 20_000);
});

const REASON: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

describe('watching and steering what is being watched', () => {
  const watching = (presence: ReturnType<typeof build>['presence'], clientId = 'tab-1') => {
    presence.connect(clientId, null, null, 'Chrome on macOS', () => {});
    presence.startPlayback(clientId, {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan: {
        mediaId: 'media-1',
        container: { kind: 'passthrough', reason: REASON },
        video: { kind: 'passthrough', reason: REASON },
        audio: { kind: 'passthrough', streamIndex: 1, reason: REASON },
        subtitles: { kind: 'none', reason: REASON },
      },
    });
  };

  it('lists who is watching what', async () => {
    const { app, store, permissions, presence } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    watching(presence);

    const response = await app.request(`${BASE}/api/admin/sessions`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ clientId: 'tab-1' }]);
  });

  it('pauses somebody else’s stream', async () => {
    const { app, store, permissions, presence } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    watching(presence);

    const response = await app.request(`${BASE}/api/admin/sessions/tab-1/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(presence.list()[0]?.playback).toMatchObject({ pausedByAdmin: true });
  });

  it('has nothing to pause in a tab that is not open', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/sessions/nobody/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  it('refuses to pause a tab that is not watching anything', async () => {
    const { app, store, permissions, presence } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    presence.connect('tab-1', null, null, 'Chrome on macOS', () => {});

    const response = await app.request(`${BASE}/api/admin/sessions/tab-1/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(409);
  });

  it('lets a paused stream go again', async () => {
    const { app, store, permissions, presence } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    watching(presence);
    presence.pause('tab-1', 'paused');

    const response = await app.request(`${BASE}/api/admin/sessions/tab-1/resume`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(presence.list()[0]?.playback).toMatchObject({ pausedByAdmin: false });
  });

  it('has nothing to resume in a tab that is not open', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/sessions/nobody/resume`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  it('stops somebody else’s stream', async () => {
    const { app, store, permissions, presence } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    watching(presence);

    const response = await app.request(`${BASE}/api/admin/sessions/tab-1`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(presence.list()[0]?.playback).toBeNull();
  });

  it('has nothing to stop in a tab that is not open', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/sessions/nobody`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  describe('the session list an admin page keeps open', () => {
    it('turns away somebody who may not watch streams', async () => {
      const { app } = build();
      const cookie = await signedIn(app);

      const response = await app.request(`${BASE}/api/admin/sessions/stream`, {
        headers: { cookie, origin: BASE },
      });

      expect(response.status).toBe(403);
    });

    it('sends the list as an event stream, and again whenever it changes', async () => {
      const { app, store, permissions, presence } = build();
      const cookie = await signedInAsAdmin(app, store, permissions);
      const controller = new AbortController();

      const response = await app.request(`${BASE}/api/admin/sessions/stream`, {
        headers: { cookie, origin: BASE },
        signal: controller.signal,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      watching(presence);

      controller.abort();
      await response.body?.cancel();
    });
  });
});

describe('what the media service says about itself', () => {
  const withMonitor = (
    monitor?: () => Promise<JsonValue>,
    monitorStream?: () => Promise<ReadableStream<Uint8Array> | null>,
  ) => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = createApp({
      auth,
      settings,
      permissions,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService({ libraries: [LIBRARY], media: [] }),
      playback: createMemoryPlaybackService(),
      segments: createMemorySegmentService(),
      subtitles: createMemorySubtitleService({}),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      ...(monitor === undefined ? {} : { monitor }),
      ...(monitorStream === undefined ? {} : { monitorStream }),
    });

    return { app, store, permissions };
  };

  it('passes on the reading it was given', async () => {
    const context = withMonitor(() => Promise.resolve({ sessions: 2 }));
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/monitor`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessions: 2 });
  });

  it('says the media service did not answer, rather than answering with nothing', async () => {
    const context = withMonitor(() => Promise.reject(new Error('unreachable')));
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/monitor`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(503);
  });

  it('says the same on a server with no media service behind it at all', async () => {
    const context = withMonitor();
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/monitor`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(503);
  });

  it('holds a reading stream open for a page that is watching', async () => {
    const context = withMonitor(undefined, () =>
      Promise.resolve(
        new ReadableStream<Uint8Array>({
          start: (controller) => {
            controller.enqueue(new TextEncoder().encode('data: {}\n\n'));
            controller.close();
          },
        }),
      ),
    );
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/monitor/stream`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('says the media service did not answer when there is no stream to hold', async () => {
    const context = withMonitor(undefined, () => Promise.resolve(null));
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/monitor/stream`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(503);
  });

  it('will not let an ordinary account watch the readings', async () => {
    const context = withMonitor(() => Promise.resolve({ sessions: 0 }));
    const cookie = await signedIn(context.app);

    const response = await context.app.request(`${BASE}/api/admin/monitor/stream`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });
});

describe('searching the catalogue from the admin page', () => {
  it('passes what the catalogue offered straight through', async () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = createApp({
      auth,
      settings,
      permissions,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService({ libraries: [LIBRARY], media: [] }),
      playback: createMemoryPlaybackService(),
      segments: createMemorySegmentService(),
      subtitles: createMemorySubtitleService({}),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      searchCatalogue: (query, kind) =>
        Promise.resolve([
          {
            externalId: '329',
            kind,
            title: query,
            year: 2016,
            overview: null,
            posterUrl: null,
          },
        ]),
    });

    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(
      `${BASE}/api/admin/catalogue/search?query=Arrival&kind=movie`,
      { headers: { cookie, origin: BASE } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ matches: [{ title: 'Arrival', kind: 'movie' }] });
  });

  it('offers nothing on a server with no catalogue behind it', async () => {
    const { app, store, permissions } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(
      `${BASE}/api/admin/catalogue/search?query=Arrival&kind=movie`,
      { headers: { cookie, origin: BASE } },
    );

    expect(await response.json()).toEqual({ matches: [] });
  });
});

describe('what the caches are holding', () => {
  const COUNT = { count: 3, bytes: 4096, atMs: 1 };

  const withStorage = (
    measureStorage?: () => Promise<{
      cache: {
        previews: typeof COUNT;
        trickplay: typeof COUNT;
        sessions: typeof COUNT;
        atMs: number;
      } | null;
      artwork: { count: number; bytes: number; atMs: number } | null;
      libraryBytes: number;
    }>,
  ) => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = createApp({
      auth,
      settings,
      permissions,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService({ libraries: [LIBRARY], media: [] }),
      playback: createMemoryPlaybackService(),
      segments: createMemorySegmentService(),
      subtitles: createMemorySubtitleService({}),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      ...(measureStorage === undefined ? {} : { measureStorage }),
    });

    return { app, store, permissions };
  };

  it('counts what is held, when the server can measure it', async () => {
    const context = withStorage(() =>
      Promise.resolve({
        cache: { previews: COUNT, trickplay: COUNT, sessions: COUNT, atMs: 1 },
        artwork: { count: 10, bytes: 2048, atMs: 1 },
        libraryBytes: 1024,
      }),
    );
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/storage/measure`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ libraryBytes: 1024, artwork: { count: 10 } });
  });

  it('answers with nothing measured rather than failing, on a server that cannot', async () => {
    const context = withStorage();
    const cookie = await signedInAsAdmin(context.app, context.store, context.permissions);

    const response = await context.app.request(`${BASE}/api/admin/storage/measure`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cache: null, artwork: null, libraryBytes: 0 });
  });

  it('will not let an ordinary account ask', async () => {
    const context = withStorage();
    const cookie = await signedIn(context.app);

    const response = await context.app.request(`${BASE}/api/admin/storage/measure`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });
});

describe('changing one setting without disturbing the others', () => {
  it('changes the catalogue key alone', async () => {
    const { app, store, permissions, settings } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    const response = await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    });

    expect(response.status).toBe(200);
    expect((await settings.read()).catalogueApiKey).toBe('a-key');
  });

  it('changes the hardware backend alone', async () => {
    const { app, store, permissions, settings } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ hardwareAccel: 'nvenc' }),
    });

    expect((await settings.read()).hardwareAccel).toBe('nvenc');
  });

  it('leaves a setting alone when a change does not mention it', async () => {
    const { app, store, permissions, settings } = build();
    const cookie = await signedInAsAdmin(app, store, permissions);

    await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ hardwareAccel: 'nvenc' }),
    });

    await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    });

    const current = await settings.read();

    expect(current).toMatchObject({ hardwareAccel: 'nvenc', catalogueApiKey: 'a-key' });
  });
});
