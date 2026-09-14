import { describe, expect, it } from 'vitest';
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
import { createMemoryDownloadService } from '@ValenceServer/downloads/createMemoryDownloadService';
import { DownloadListSchema, DownloadSchema } from '@ValenceContracts/schemas/Download';
import type { MediaDetail } from '@ValenceContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';
const SERIES_ID = 'a-programme';
const OTHER_MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bd0';
const A_SHARED_DEVICE = 'a-device-two-people-name';

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
  email: 'marques@valence.local',
  password: 'a-long-enough-password',
};

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const downloads = createMemoryDownloadService();

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
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    downloads,
  });

  return { app, downloads };
};

/**
 * Somebody signed in, and the cookie that says so.
 *
 * @param app - The application.
 * @param credentials - Who to sign up, where a test needs more than one account.
 * @returns The cookie.
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
 * Asks for something to be prepared.
 *
 * @param app - The application.
 * @param cookie - Who is asking.
 * @param quality - Which rung.
 * @returns The response.
 */
const ask = async (app: ReturnType<typeof build>['app'], cookie: string, quality = '1080p') =>
  app.request(`${BASE}/api/media/${MEDIA_ID}/downloads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin: BASE },
    body: JSON.stringify({ quality }),
  });

describe('downloads over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/downloads`)).status).toBe(401);
  });

  it('will not prepare anything for nobody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/downloads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ quality: '1080p' }),
    });

    expect(response.status).toBe(401);
  });

  it('has nothing to say about a viewer who has asked for nothing', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const listed = DownloadListSchema.parse(
      await (
        await app.request(`${BASE}/api/downloads`, { headers: { cookie, origin: BASE } })
      ).json(),
    );

    expect(listed.downloads).toEqual([]);
  });

  it('starts one on request and says it is being prepared', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const started = DownloadSchema.parse(await (await ask(app, cookie)).json());

    expect(started.state).toBe('preparing');
    expect(started.quality).toBe('1080p');
  });

  it('does not start a second one for the same thing, since one is already under way', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    await ask(app, cookie);
    await ask(app, cookie);

    expect(Object.values(downloads.state.downloads).flat()).toHaveLength(1);
  });

  it('treats a different rung as a different thing to prepare', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    await ask(app, cookie, '1080p');
    await ask(app, cookie, '720p');

    expect(Object.values(downloads.state.downloads).flat()).toHaveLength(2);
  });

  it('lists what has been asked for', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await ask(app, cookie);

    const listed = DownloadListSchema.parse(
      await (
        await app.request(`${BASE}/api/downloads`, { headers: { cookie, origin: BASE } })
      ).json(),
    );

    expect(listed.downloads).toHaveLength(1);
  });

  it('stops keeping one on the server when told to', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    const started = DownloadSchema.parse(await (await ask(app, cookie)).json());

    const response = await app.request(`${BASE}/api/downloads/${started.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(Object.values(downloads.state.downloads).flat()).toEqual([]);
  });

  it('queues every episode of a programme on one ask', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    downloads.state.episodes[SERIES_ID] = [MEDIA_ID, OTHER_MEDIA_ID];

    const queued = DownloadListSchema.parse(
      await (
        await app.request(`${BASE}/api/series/${SERIES_ID}/downloads`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, origin: BASE },
          body: JSON.stringify({ quality: '1080p' }),
        })
      ).json(),
    );

    expect(queued.downloads).toHaveLength(2);
  });

  it('pauses one on request, so it stops without losing what it has done', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    const started = DownloadSchema.parse(await (await ask(app, cookie)).json());

    const response = await app.request(`${BASE}/api/downloads/${started.id}/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(Object.values(downloads.state.downloads).flat()[0]?.state).toBe('paused');
  });

  it('carries on from where it stopped when resumed', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    const started = DownloadSchema.parse(await (await ask(app, cookie)).json());

    await app.request(`${BASE}/api/downloads/${started.id}/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    await app.request(`${BASE}/api/downloads/${started.id}/resume`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(Object.values(downloads.state.downloads).flat()[0]?.state).toBe('queued');
  });

  it('will not pause or resume for nobody', async () => {
    const { app } = build();

    const paused = await app.request(
      `${BASE}/api/downloads/00000000-0000-4000-8000-00000000000a/pause`,
      { method: 'POST', headers: { origin: BASE } },
    );

    expect(paused.status).toBe(401);
  });

  it('records what a device says it is holding, and what it has let go', async () => {
    const { app, downloads } = build();
    const cookie = await signedIn(app);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/holdings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ quality: '1080p' }),
    });

    expect(Object.values(downloads.state.holdings).flat()).toHaveLength(1);

    await app.request(`${BASE}/api/media/${MEDIA_ID}/holdings/1080p`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(Object.values(downloads.state.holdings).flat()).toEqual([]);
  });

  it('lets go of a holding only for whoever is asking, whatever device they name', async () => {
    const { app, downloads } = build();
    const mine = await signedIn(app);
    const theirs = await signedIn(app, {
      name: 'Somebody else',
      email: 'else@valence.local',
      password: 'a-long-enough-password',
    });

    await app.request(`${BASE}/api/media/${MEDIA_ID}/holdings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-valence-client': A_SHARED_DEVICE,
        cookie: mine,
        origin: BASE,
      },
      body: JSON.stringify({ quality: '1080p' }),
    });

    const letGo = await app.request(`${BASE}/api/media/${MEDIA_ID}/holdings/1080p`, {
      method: 'DELETE',
      headers: { 'x-valence-client': A_SHARED_DEVICE, cookie: theirs, origin: BASE },
    });

    expect(theirs).not.toBe('');
    expect(theirs).not.toBe(mine);
    expect(letGo.status).toBe(204);
    expect(Object.values(downloads.state.holdings).flat()).toHaveLength(1);
  });
});
