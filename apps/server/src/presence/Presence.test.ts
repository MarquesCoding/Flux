import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createPresenceService } from './PresenceService';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
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

  describe('the stream a tab holds open', () => {
    const openStream = async (
      app: ReturnType<typeof build>['app'],
      cookie: string,
      query = 'clientId=tab-1&deviceLabel=Chrome+on+macOS',
    ) => {
      const controller = new AbortController();

      const response = await app.request(`${BASE}/api/presence/stream?${query}`, {
        headers: { cookie, origin: BASE },
        signal: controller.signal,
      });

      return {
        response,
        stop: () => {
          controller.abort();
        },
      };
    };

    it('turns nobody signed in away', async () => {
      const { app } = build();

      const response = await app.request(`${BASE}/api/presence/stream?clientId=tab-1`, {
        headers: { origin: BASE },
      });

      expect(response.status).toBe(401);
    });

    it('refuses a tab that will not say which one it is', async () => {
      const { app } = build();
      const cookie = await signedIn(app);

      const { response } = await openStream(app, cookie, 'deviceLabel=Chrome');

      expect(response.status).toBe(400);
    });

    it('holds the connection open as an event stream', async () => {
      const { app, presence } = build();
      const cookie = await signedIn(app);

      const { response, stop } = await openStream(app, cookie);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(presence.list()).toMatchObject([
        { clientId: 'tab-1', deviceLabel: 'Chrome on macOS' },
      ]);

      stop();
      await response.body?.cancel();
    });

    it('names the device as unknown when a tab does not say what it is', async () => {
      const { app, presence } = build();
      const cookie = await signedIn(app);

      const { response, stop } = await openStream(app, cookie, 'clientId=tab-1');

      expect(presence.list()).toMatchObject([{ deviceLabel: 'Unknown device' }]);

      stop();
      await response.body?.cancel();
    });

    it('sends what presence tells it, down the connection the tab is holding', async () => {
      const { app, presence } = build();
      const cookie = await signedIn(app);

      const { response, stop } = await openStream(app, cookie);

      expect(presence.stop('tab-1', 'An administrator stopped this stream.')).toBe(true);
      expect(presence.list()).toMatchObject([{ clientId: 'tab-1', playback: null }]);

      stop();
      await response.body?.cancel();
    });

    it('forgets the tab once the connection is let go', async () => {
      const { app, presence } = build();
      const cookie = await signedIn(app);

      const { response, stop } = await openStream(app, cookie);

      stop();
      await response.body?.cancel();

      expect(presence.list()).toEqual([]);
    });
  });
});
