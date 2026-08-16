import { describe, expect, it } from 'vitest';
import { z } from 'zod';
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
import { createMemoryHistoryService } from '@FluxServer/history/createMemoryHistoryService';
import { MOST_PER_GAP_SECONDS } from '@FluxServer/progress/accumulateWatchTime';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const ViewingSchema = z.object({
  id: z.string(),
  mediaItemId: z.string(),
  secondsWatched: z.number(),
  isFinished: z.boolean(),
});

const HistorySchema = z.object({ viewings: z.array(ViewingSchema) });

const MEDIA_ID = '5f7c8a1e-2b4d-4c6e-9a3f-1d2e3b4c5d6e';
const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const inTheLibrary: MediaDetail = {
  id: MEDIA_ID,
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7_200,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  width: 1920,
  height: 1080,
  bitrateKbps: 12_000,
  audioStreams: [],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
};

const build = async () => {
  const { auth, settings, store } = createMemoryAuth();
  const history = createMemoryHistoryService();

  const app = createApp({
    auth,
    settings,
    permissions: createMemoryPermissionService(),
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService({ libraries: [], media: [inTheLibrary] }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    profiles: createMemoryProfileService(),
    history,
  });

  const cookie = await signUpForTest(app);

  const request = (path: string, method = 'GET', body?: object) =>
    app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: {
        cookie,
        origin: TEST_ORIGIN,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const listed = async () => HistorySchema.parse(await (await request('/api/history')).json());

  return { app, request, listed, history, store };
};

const report = (positionSeconds: number, isFinished = false) => ({
  positionSeconds,
  durationSeconds: 7_200,
  isFinished,
});

describe('a profile’s history', () => {
  it('records progress at all, which everything else here depends on', async () => {
    const { request } = await build();

    expect((await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0))).status).toBe(204);
  });

  it('is empty before anything has been watched', async () => {
    const { listed } = await build();

    expect((await listed()).viewings).toEqual([]);
  });

  it('refuses to answer somebody who is not signed in', async () => {
    const { app } = await build();

    const response = await app.request(`${TEST_ORIGIN}/api/history`, {
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(401);
  });

  it('remembers something watched, once a report says how far it got', async () => {
    const { request, listed } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(600));

    const { viewings } = await listed();

    expect(viewings).toHaveLength(1);
    expect(viewings[0]?.mediaItemId).toBe(MEDIA_ID);
  });

  it('has nothing to remember from a first report alone', async () => {
    const { request, listed } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));

    expect((await listed()).viewings).toEqual([]);
  });

  it('remembers something finished, however it got there', async () => {
    const { request, listed } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(7_200, true));

    const { viewings } = await listed();

    expect(viewings[0]?.isFinished).toBe(true);
  });

  it('never credits a jump across a film as having watched the film', async () => {
    const { request, history } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(7_200, true));

    const [viewing] = history.state.viewings;

    expect(viewing?.secondsWatched).toBeLessThanOrEqual(MOST_PER_GAP_SECONDS);
  });

  it('lets a viewer forget one thing', async () => {
    const { request, listed } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(600));

    const { viewings } = await listed();

    expect((await request(`/api/history/${viewings[0]?.id ?? ''}`, 'DELETE')).status).toBe(204);
    expect((await listed()).viewings).toEqual([]);
  });

  it('says there is no such viewing rather than forgetting somebody else’s', async () => {
    const { request } = await build();

    expect((await request('/api/history/not-a-viewing', 'DELETE')).status).toBe(404);
  });

  it('lets a viewer forget the lot', async () => {
    const { request, listed } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(600));

    const response = await request('/api/history', 'DELETE');

    expect(response.status).toBe(200);
    expect((await listed()).viewings).toEqual([]);
  });

  it('answers a page at a time', async () => {
    const { request } = await build();

    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(0));
    await request(`/api/media/${MEDIA_ID}/progress`, 'PUT', report(600));

    const response = await request('/api/history?limit=1');

    expect(HistorySchema.parse(await response.json()).viewings).toHaveLength(1);
  });

  it('documents itself in the specification', async () => {
    const { app } = await build();

    const body = await (await app.request(`${TEST_ORIGIN}/api/openapi.json`)).json();

    expect(body).toHaveProperty(['paths', '/api/history', 'get']);
  });
});
