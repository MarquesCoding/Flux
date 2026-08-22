import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createPresenceService } from './PresenceService';
import type { PlaybackPlan, Reason } from '@ValenceContracts/schemas/PlaybackPlan';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@valence.local',
  password: 'a-long-enough-password',
};

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const plan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const presence = createPresenceService();

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    presence,
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
  });

  return { app, presence };
};

const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

describe('presence over HTTP', () => {
  it('refuses a heartbeat from nobody signed in', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/presence/tab-1/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ isPlaying: true }),
    });

    expect(response.status).toBe(401);
  });

  it('refuses to say a tab stopped watching from nobody signed in', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/presence/tab-1/watching`, {
      method: 'DELETE',
      headers: { origin: BASE },
    });

    expect(response.status).toBe(401);
  });

  it('says a tab has stopped watching', async () => {
    const { app, presence } = build();
    const cookie = await signedIn(app);

    presence.connect('tab-1', null, null, 'Chrome on macOS', vi.fn());
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan,
    });

    const response = await app.request(`${BASE}/api/presence/tab-1/watching`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    expect(presence.list()).toMatchObject([{ clientId: 'tab-1', playback: null }]);
  });

  it('does not clear presence when a session is stopped for an ordinary reason, like a quality change', async () => {
    const { app, presence } = build();
    const cookie = await signedIn(app);

    presence.connect('tab-1', null, null, 'Chrome on macOS', vi.fn());
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan,
    });

    await app.request(`${BASE}/api/playback/session/direct-media-1`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(presence.list()).toMatchObject([
      { clientId: 'tab-1', playback: { mediaTitle: 'Arrival' } },
    ]);
  });

  it('records a heartbeat from a tab that is signed in', async () => {
    const { app, presence } = build();
    const cookie = await signedIn(app);

    presence.connect('tab-1', null, null, 'Chrome on macOS', vi.fn());
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan,
    });

    const response = await app.request(`${BASE}/api/presence/tab-1/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({
        isPlaying: false,
        health: {
          positionSeconds: 42,
          durationSeconds: 7200,
          bufferedAheadSeconds: 12,
          presentedWidth: 1920,
          presentedHeight: 1080,
        },
      }),
    });

    expect(response.status).toBe(204);
    expect(presence.list()[0]?.playback).toMatchObject({
      isPlaying: false,
      health: { positionSeconds: 42 },
    });
  });
});
