import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
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

const FavouriteListSchema = z.object({
  favourites: z.array(z.object({ mediaId: z.string(), keptAt: z.string() })),
});

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const favourites = createMemoryFavouriteService();
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
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites,
    ratings: createMemoryRatingService(),
  });

  return { app, favourites };
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

const kept = async (app: ReturnType<typeof build>['app'], cookie: string) =>
  FavouriteListSchema.parse(
    await (
      await app.request(`${BASE}/api/favourites`, { headers: { cookie, origin: BASE } })
    ).json(),
  ).favourites;

describe('favourites over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/favourites`)).status).toBe(401);
  });

  it('will not keep anything for nobody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'PUT',
    });

    expect(response.status).toBe(401);
  });

  it('has nothing to say about a viewer who has kept nothing', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await expect(kept(app, cookie)).resolves.toEqual([]);
  });

  it('keeps something on request', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'PUT',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    await expect(kept(app, cookie)).resolves.toMatchObject([{ mediaId: MEDIA_ID }]);
  });

  it('answers the same way when something is kept twice', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'PUT',
      headers: { cookie, origin: BASE },
    });
    const again = await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'PUT',
      headers: { cookie, origin: BASE },
    });

    expect(again.status).toBe(204);
    await expect(kept(app, cookie)).resolves.toHaveLength(1);
  });

  it('stops keeping something on request', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'PUT',
      headers: { cookie, origin: BASE },
    });
    const dropped = await app.request(`${BASE}/api/media/${MEDIA_ID}/favourite`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(dropped.status).toBe(204);
    await expect(kept(app, cookie)).resolves.toEqual([]);
  });

  it('refuses to keep something the library has never heard of', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(
      `${BASE}/api/media/11111111-2222-3333-4444-555555555555/favourite`,
      { method: 'PUT', headers: { cookie, origin: BASE } },
    );

    expect(response.status).toBe(404);
  });
});
