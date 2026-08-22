import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@ValenceServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { HouseholdRatingSchema, RatingListSchema } from '@ValenceContracts/schemas/Rating';
import type { MediaDetail } from '@ValenceContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';
const SERIES_ID = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const ABSENT_ID = '00000000-0000-4000-8000-000000000000';

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

const ItemPageSchema = z.object({ total: z.number() });

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@valence.local',
  password: 'a-long-enough-password',
};

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const ratings = createMemoryRatingService();
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
      series: [{ id: SERIES_ID, title: 'The Bear' }],
      starsFor: (mediaId) =>
        Object.values(ratings.state)
          .flat()
          .find((entry) => entry.mediaId === mediaId)?.stars ?? null,
    }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings,
  });

  return { app, ratings };
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

/**
 * Everything the signed-in viewer has rated, read back through the API.
 */
const rated = async (app: ReturnType<typeof build>['app'], cookie: string) =>
  RatingListSchema.parse(
    await (await app.request(`${BASE}/api/ratings`, { headers: { cookie, origin: BASE } })).json(),
  ).ratings;

/**
 * Gives something a rating over HTTP.
 */
const rate = (app: ReturnType<typeof build>['app'], cookie: string, path: string, stars: number) =>
  app.request(`${BASE}${path}/rating`, {
    method: 'PUT',
    headers: { cookie, origin: BASE, 'content-type': 'application/json' },
    body: JSON.stringify({ stars }),
  });

describe('ratings over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/ratings`)).status).toBe(401);
  });

  it('will not rate anything for nobody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/rating`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stars: 4 }),
    });

    expect(response.status).toBe(401);
  });

  it('has nothing to say about a viewer who has rated nothing', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await expect(rated(app, cookie)).resolves.toEqual([]);
  });

  it('rates an item on request', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/media/${MEDIA_ID}`, 4)).status).toBe(204);

    const held = await rated(app, cookie);

    expect(held).toHaveLength(1);
    expect(held[0]?.mediaId).toBe(MEDIA_ID);
    expect(held[0]?.stars).toBe(4);
  });

  it('rates a programme on request', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/series/${SERIES_ID}`, 5)).status).toBe(204);

    const held = await rated(app, cookie);

    expect(held[0]?.seriesId).toBe(SERIES_ID);
    expect(held[0]?.mediaId).toBeNull();
  });

  it('replaces a rating rather than recording a second', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 4);
    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 2);

    const held = await rated(app, cookie);

    expect(held).toHaveLength(1);
    expect(held[0]?.stars).toBe(2);
  });

  it('refuses a rating off the end of the scale', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/media/${MEDIA_ID}`, 0)).status).toBe(400);
    expect((await rate(app, cookie, `/api/media/${MEDIA_ID}`, 6)).status).toBe(400);
  });

  it('refuses half a star, since the scale is whole steps', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/media/${MEDIA_ID}`, 3.5)).status).toBe(400);
  });

  it('says nothing doing for an item that is not there', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/media/${ABSENT_ID}`, 4)).status).toBe(404);
  });

  it('says nothing doing for a programme that is not there', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    expect((await rate(app, cookie, `/api/series/${ABSENT_ID}`, 4)).status).toBe(404);
  });

  it('takes a rating back', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 4);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/rating`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    await expect(rated(app, cookie)).resolves.toEqual([]);
  });

  it('reports what the household gave an item', async () => {
    const { app, ratings } = build();
    const cookie = await signedIn(app);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 5);
    await ratings.set('someone-else', { mediaId: MEDIA_ID }, 4);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/rating/household`, {
      headers: { cookie, origin: BASE },
    });

    expect(HouseholdRatingSchema.parse(await response.json())).toEqual({ average: 4.5, count: 2 });
  });

  it('reports what the household gave a programme', async () => {
    const { app, ratings } = build();
    const cookie = await signedIn(app);

    await ratings.set('someone-else', { seriesId: SERIES_ID }, 3);

    const response = await app.request(`${BASE}/api/series/${SERIES_ID}/rating/household`, {
      headers: { cookie, origin: BASE },
    });

    expect(HouseholdRatingSchema.parse(await response.json())).toEqual({ average: 3, count: 1 });
  });

  it('reports nothing rather than zero for an item nobody has rated', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/rating/household`, {
      headers: { cookie, origin: BASE },
    });

    expect(HouseholdRatingSchema.parse(await response.json())).toEqual({
      average: null,
      count: 0,
    });
  });

  it('will not report the household figure to somebody who is not signed in', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/rating/household`);

    expect(response.status).toBe(401);
  });
});

describe('sorting and filtering a library by what you gave it', () => {
  it('orders by this viewer’s rating, highest first', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 5);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?order=yourRating`,
      { headers: { cookie, origin: BASE } },
    );

    expect(response.status).toBe(200);
  });

  it('narrows to what this viewer rated at least so highly', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const before = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?minYourStars=4`, {
      headers: { cookie, origin: BASE },
    });

    expect(ItemPageSchema.parse(await before.json()).total).toBe(0);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 4);

    const after = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?minYourStars=4`, {
      headers: { cookie, origin: BASE },
    });

    expect(ItemPageSchema.parse(await after.json()).total).toBe(1);
  });

  it('leaves out something rated below what was asked for', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await rate(app, cookie, `/api/media/${MEDIA_ID}`, 2);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?minYourStars=4`, {
      headers: { cookie, origin: BASE },
    });

    expect(ItemPageSchema.parse(await response.json()).total).toBe(0);
  });

  it('refuses a floor off the end of the scale', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?minYourStars=9`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(400);
  });
});
