import { describe, expect, it } from 'vitest';
import { createApp } from './App';
import { createMemoryAuth } from './auth/createMemoryAuth';
import { createMemoryLibraryService } from './library/createMemoryLibraryService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryPlaybackService } from './playback/createMemoryPlaybackService';
import { createMemoryPermissionService } from './auth/createMemoryPermissionService';
import { signedInApp, TEST_ORIGIN } from './auth/signUpForTest';
import type { RunningJob } from './jobs/JobQueue';

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
    expect(body).toMatchObject({ openapi: '3.1.0', info: { title: 'Flux API' } });
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
