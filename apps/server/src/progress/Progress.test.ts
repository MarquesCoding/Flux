import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from './createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';

const FILM: MediaDetail = {
  id: MEDIA_ID,
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: true }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
};

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const ProgressListSchema = z.object({
  progress: z.array(
    z.object({ mediaId: z.string(), positionSeconds: z.number(), isFinished: z.boolean() }),
  ),
});

const build = () => {
  const profiles = createMemoryProfileService();
  const { auth, settings, store } = createMemoryAuth();
  const progress = createMemoryWatchProgressService();

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService({
      libraries: [
        {
          id: LIBRARY_ID,
          name: 'Films',
          kind: 'movies',
          path: '/media/films',
          itemCount: 1,
          lastScannedAt: null,
          defaultAudioLanguage: null,
          filesAtOnce: null,
        },
      ],
      media: [FILM],
    }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles,
    progress,
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
  });

  return { app, progress, profiles, store };
};

/**
 * Somebody signed in, and the cookie that says so.
 */
const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

const REPORT = { positionSeconds: 600, durationSeconds: 7200 };

describe('watch progress over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/progress`);

    expect(response.status).toBe(401);
  });

  it('will not record a position for nobody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(REPORT),
    });

    expect(response.status).toBe(401);
  });

  it('has nothing to say about a viewer who has watched nothing', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/progress`, {
      headers: { cookie, origin: BASE },
    });

    expect(ProgressListSchema.parse(await response.json()).progress).toEqual([]);
  });

  it('records where somebody got to', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const recorded = await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify(REPORT),
    });

    expect(recorded.status).toBe(204);
  });

  it('reads back what it recorded', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify(REPORT),
    });

    const response = await app.request(`${BASE}/api/progress`, {
      headers: { cookie, origin: BASE },
    });
    const body = ProgressListSchema.parse(await response.json());

    expect(body.progress).toMatchObject([{ mediaId: MEDIA_ID, positionSeconds: 600 }]);
  });

  it('does not call something finished unless it was said to be', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify(REPORT),
    });

    const body = ProgressListSchema.parse(
      await (
        await app.request(`${BASE}/api/progress`, { headers: { cookie, origin: BASE } })
      ).json(),
    );

    expect(body.progress[0]?.isFinished).toBe(false);
  });

  it('records that something was finished', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ ...REPORT, positionSeconds: 7190, isFinished: true }),
    });

    const body = ProgressListSchema.parse(
      await (
        await app.request(`${BASE}/api/progress`, { headers: { cookie, origin: BASE } })
      ).json(),
    );

    expect(body.progress[0]?.isFinished).toBe(true);
  });

  it('refuses a position that is not one', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ positionSeconds: -30, durationSeconds: 7200 }),
    });

    expect(response.status).toBe(400);
  });

  it('refuses an item with no length, which nothing can be a fraction of', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ positionSeconds: 600, durationSeconds: 0 }),
    });

    expect(response.status).toBe(400);
  });

  it('forgets an item, so it starts over', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify(REPORT),
    });

    const forgotten = await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    const body = ProgressListSchema.parse(
      await (
        await app.request(`${BASE}/api/progress`, { headers: { cookie, origin: BASE } })
      ).json(),
    );

    expect(forgotten.status).toBe(204);
    expect(body.progress).toEqual([]);
  });
});

describe('which viewer a request is about', () => {
  const PROFILE_HEADER = 'x-flux-profile';

  it('records against the profile the request names, when it belongs to that account', async () => {
    const { app, profiles, store } = build();
    const cookie = await signedIn(app);

    const listed = await app.request(`${BASE}/api/profiles`, {
      headers: { cookie, origin: BASE },
    });
    const { profiles: held } = z
      .object({ profiles: z.array(z.object({ id: z.string(), name: z.string() })) })
      .parse(await listed.json());

    const second = await profiles.create(store.user[0]?.id ?? '', {
      name: 'Dan',
      colour: '#e8a33a',
    });

    await app.request(`${BASE}/api/media/${MEDIA_ID}/progress`, {
      method: 'PUT',
      headers: {
        cookie,
        origin: BASE,
        'content-type': 'application/json',
        [PROFILE_HEADER]: second.id,
      },
      body: JSON.stringify({ positionSeconds: 42, durationSeconds: 7200 }),
    });

    const mine = await app.request(`${BASE}/api/progress`, {
      headers: { cookie, origin: BASE, [PROFILE_HEADER]: second.id },
    });

    expect(await mine.json()).toMatchObject({ progress: [{ positionSeconds: 42 }] });
    expect(held[0]?.name).toBeDefined();
  });

  it('falls back to the account’s own profile when the one named is somebody else’s', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/progress`, {
      headers: { cookie, origin: BASE, [PROFILE_HEADER]: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
    });

    expect(response.status).toBe(200);
  });
});
