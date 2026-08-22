import { describe, expect, it } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signedInApp } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createPresenceService } from '@ValenceServer/presence/PresenceService';
import type { MediaDetail } from '@ValenceContracts/schemas/Library';
import { createMemoryPlaybackService } from './createMemoryPlaybackService';
import { z } from 'zod';
import { PlaybackPlanSchema } from '@ValenceContracts/schemas/PlaybackPlan';
import type { MediaItem } from '@ValenceContracts/schemas/MediaItem';

const ExplainSchema = z.object({ mode: z.string(), plan: PlaybackPlanSchema });

const StartSchema = z.object({
  sessionId: z.string(),
  delivery: z.union([
    z.object({ kind: z.literal('hls'), manifestUrl: z.string() }),
    z.object({ kind: z.literal('direct'), url: z.string() }),
  ]),
  mode: z.string(),
  plan: PlaybackPlanSchema,
  warnings: z.array(z.string()),
});

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const hdrMedia: MediaItem = {
  id: MEDIA_ID,
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
};

const modestProfile = {
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 1920,
  maxHeight: 1080,
  maxBitrateKbps: 8000,
  maxAudioChannels: 2,
  supportedVideoRanges: ['SDR'],
  tenBitVideoCodecs: [],
  maxVideoLevels: {},
  canPlayInterlaced: true,
  canPlayAnamorphic: true,
  canRotate: true,
  unsupportedAudioProfiles: [],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

const capableProfile = {
  ...modestProfile,
  name: 'Living room TV',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40000,
  maxAudioChannels: 8,
  supportedVideoRanges: ['SDR', 'HDR10'],
  tenBitVideoCodecs: [],
  maxVideoLevels: {},
  canPlayInterlaced: true,
  canPlayAnamorphic: true,
  canRotate: true,
  unsupportedAudioProfiles: [],
  directPlayProfiles: [
    { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['truehd', 'aac'] },
  ],
};

const MODEST_MEDIA_ID = '11111111-1111-4111-8111-111111111111';

const modestMedia: MediaItem = {
  id: MODEST_MEDIA_ID,
  title: 'A Modest Film',
  year: 2020,
  container: 'mkv',
  durationSeconds: 6000,
  videoCodec: 'h264',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 1920,
  height: 1080,
  bitrateKbps: 3000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
};

const build = (options: { unsupported?: boolean } = {}) => {
  const { auth, settings, store } = createMemoryAuth();
  const playback = createMemoryPlaybackService({
    media: { [MEDIA_ID]: hdrMedia, [MODEST_MEDIA_ID]: modestMedia },
    sessions: {},
    ...(options.unsupported === true ? { unsupported: true } : {}),
  });

  const permissions = createMemoryPermissionService();

  const app = createApp({
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
    playback,
  });

  return { app: signedInApp(app, { store, permissions, isAdministrator: true }), playback };
};

const post = (path: string, body: object) =>
  new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(body),
  });

describe('playback explain', () => {
  it('explains a real library item', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: 'Transcode' });
  });

  it('explains why, on every axis', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }),
    );
    const body = ExplainSchema.parse(await response.json());

    expect(body.plan.video.reason.code).toBe('VideoCodecNotSupported');
    expect(body.plan.audio.reason.code).toBe('AudioCodecNotSupported');
    expect(body.plan.container.reason.detail).toBeTruthy();
  });

  it('reports direct play for a capable client', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: capableProfile }),
    );

    expect(await response.json()).toMatchObject({ mode: 'DirectPlay' });
  });

  it('starts nothing when only explaining', async () => {
    const { app, playback } = build();

    await app.request(post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }));

    expect(Object.keys(playback.state.sessions)).toHaveLength(0);
  });

  it('reports an unknown item', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MISSING_ID}/explain`, { deviceProfile: modestProfile }),
    );

    expect(response.status).toBe(404);
  });

  it('rejects an invalid device profile', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, {
        deviceProfile: { ...modestProfile, directPlayProfiles: [] },
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe('playback sessions', () => {
  it('starts a session and returns a manifest url', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    );
    const body = StartSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.delivery.kind).toBe('hls');
    expect(body.delivery.kind === 'hls' && body.delivery.manifestUrl).toContain(
      '/api/playback/session/',
    );
  });

  it('reports the mode and plan alongside the session', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    );
    const body = StartSchema.parse(await response.json());

    expect(body).toMatchObject({ mode: 'Transcode' });
    expect(body.plan.video.reason.code).toBe('VideoCodecNotSupported');
  });

  it('serves the manifest through the server rather than the media service', async () => {
    const { app } = build();

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    );

    const manifestUrl = started.delivery.kind === 'hls' ? started.delivery.manifestUrl : '';
    const manifest = await app.request(`${BASE}${manifestUrl}`);

    expect(manifest.status).toBe(200);
    expect(manifest.headers.get('content-type')).toContain('mpegurl');
    expect(await manifest.text()).toContain('#EXTM3U');
  });

  it('reports an unknown session file', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/playback/session/nope/index.m3u8`);

    expect(response.status).toBe(404);
  });

  it('reports an unknown item', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MISSING_ID}/session`, { deviceProfile: modestProfile }),
    );

    expect(response.status).toBe(404);
  });

  it('reports when the server cannot produce a playable stream', async () => {
    const { app } = build({ unsupported: true });

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    );

    expect(response.status).toBe(422);
    expect(z.object({ error: z.string() }).safeParse(await response.json()).success).toBe(true);
  });

  it('stops a session', async () => {
    const { app, playback } = build();

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    );

    const response = await app.request(
      new Request(`${BASE}/api/playback/session/${started.sessionId}`, { method: 'DELETE' }),
    );

    expect(response.status).toBe(204);
    expect(Object.keys(playback.state.sessions)).toHaveLength(0);
  });

  it('reports stopping an unknown session', async () => {
    const { app } = build();

    const response = await app.request(
      new Request(`${BASE}/api/playback/session/nope`, { method: 'DELETE' }),
    );

    expect(response.status).toBe(404);
  });

  it('accepts a heartbeat for a running session', async () => {
    const { app } = build();

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    );

    const response = await app.request(
      post(`/api/playback/session/${started.sessionId}/heartbeat`, { isPlaying: false }),
    );

    expect(response.status).toBe(204);
  });

  it('reports a heartbeat for an unknown session', async () => {
    const { app } = build();

    const response = await app.request(
      post('/api/playback/session/nope/heartbeat', { isPlaying: true }),
    );

    expect(response.status).toBe(404);
  });

  it('accepts a seek position', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: modestProfile,
        startSeconds: 120,
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe('a preview clip', () => {
  it('sends the whole clip when no range is asked for', async () => {
    const { app } = build();

    const response = await app.request(`/api/media/${MEDIA_ID}/preview`);

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-range')).toBeNull();
  });

  it('passes a range on to the media service rather than slicing here', async () => {
    const { app } = build();

    const response = await app.request(`/api/media/${MEDIA_ID}/preview`, {
      headers: { range: 'bytes=0-3' },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-3/4');
  });

  it('answers 404 for an item with no preview', async () => {
    const { app } = build();

    const response = await app.request(`/api/media/${MISSING_ID}/preview`);

    expect(response.status).toBe(404);
  });

  it('passes the length on so a player knows how much is coming', async () => {
    const { app } = build();

    const response = await app.request(`/api/media/${MEDIA_ID}/preview`);

    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.text()).toBe('clip');
  });
});

describe('a file served directly', () => {
  it('forwards the clip whole, with its length', async () => {
    const { app } = build();

    const response = await app.request(`/api/playback/${MEDIA_ID}/file`);

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.text()).toBe('film');
  });

  it('answers 404 for an item that does not exist', async () => {
    const { app } = build();

    const response = await app.request(`/api/playback/${MISSING_ID}/file`);

    expect(response.status).toBe(404);
  });
});

describe('trickplay', () => {
  it('reports where the seek-bar previews live', async () => {
    const { app } = build();

    const response = await app.request(post(`/api/playback/${MEDIA_ID}/trickplay`, {}));

    const body = z
      .object({ url: z.string(), tileWidth: z.number(), tileHeight: z.number() })
      .parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.url).toContain('.vtt');
    expect(body).toMatchObject({ tileWidth: 320, tileHeight: 180 });
  });

  it('refuses previews for an item that does not exist', async () => {
    const { app } = build();

    const response = await app.request(post(`/api/playback/${MISSING_ID}/trickplay`, {}));

    expect(response.status).toBe(404);
  });

  it('serves the index the url points at', async () => {
    const { app } = build();

    const started = await app.request(post(`/api/playback/${MEDIA_ID}/trickplay`, {}));
    const { url } = z.object({ url: z.string() }).parse(await started.json());

    const response = await app.request(new Request(`${BASE}${url}`));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/vtt');
    expect(await response.text()).toContain('WEBVTT');
  });

  it('answers with a not found rather than an empty body for a missing sheet', async () => {
    const { app } = build();

    const response = await app.request(
      new Request(`${BASE}/api/playback/trickplay/thumbs/sheet-999.jpg`),
    );

    expect(response.status).toBe(404);
  });

  describe('audio tracks', () => {
    it('starts an ordinary session when no track was asked for', async () => {
      const { app } = build();

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
      );
      const body = StartSchema.parse(await response.json());

      expect(body.sessionId).not.toContain('audio');
    });

    it('starts a different session for a different track', async () => {
      const { app } = build();

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, {
          deviceProfile: modestProfile,
          audioStreamIndex: 2,
        }),
      );
      const body = StartSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(body.sessionId).toContain('audio-2');
    });

    it('refuses a track index that is not one', async () => {
      const { app } = build();

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, {
          deviceProfile: modestProfile,
          audioStreamIndex: -1,
        }),
      );

      expect(response.status).toBe(400);
    });

    it('documents the choice in the specification', async () => {
      const { app } = build();
      const body = await (await app.request(`${BASE}/api/openapi.json`)).json();

      expect(body).toHaveProperty([
        'components',
        'schemas',
        'PlaybackStartRequest',
        'properties',
        'audioStreamIndex',
      ]);
    });
  });
});

describe('quality steps', () => {
  it('forces a resolution and bitrate clamp the device alone would not require', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '720p',
      }),
    );
    const body = StartSchema.parse(await response.json());

    expect(body.plan.video).toMatchObject({
      kind: 'transcode',
      maxWidth: 1280,
      maxHeight: 720,
      maxBitrateKbps: 2500,
    });
    expect(body.plan.video.reason.code).toBe('UserForcedTranscode');
  });

  it('leaves audio alone at 720p', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '720p',
      }),
    );
    const body = StartSchema.parse(await response.json());

    expect(body.plan.audio.kind).toBe('passthrough');
  });

  it('compresses audio below 720p', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '480p',
      }),
    );
    const body = StartSchema.parse(await response.json());

    expect(body.plan.audio).toMatchObject({ kind: 'transcode', maxBitrateKbps: 128 });
    expect(body.plan.audio.reason.code).toBe('UserForcedTranscode');
  });

  it('treats a step that would not reduce anything as Original', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MODEST_MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '1080p',
      }),
    );
    const body = StartSchema.parse(await response.json());

    expect(body.mode).toBe('DirectPlay');
    expect(body.plan.video.kind).toBe('passthrough');
    expect(body.plan.audio.kind).toBe('passthrough');
  });

  it('documents the choice in the specification', async () => {
    const { app } = build();
    const body = await (await app.request(`${BASE}/api/openapi.json`)).json();

    expect(body).toHaveProperty([
      'components',
      'schemas',
      'PlaybackStartRequest',
      'properties',
      'requestedQuality',
    ]);
  });
});

describe('serving the file itself', () => {
  it('sends the whole file when nothing was asked for in particular', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/playback/${MEDIA_ID}/file`);

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-type')).toBe('video/mp4');
  });

  it('sends only the part that was asked for, so seeking does not fetch the film', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/playback/${MEDIA_ID}/file`, {
      headers: { range: 'bytes=0-3' },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-3/4');
  });

  it('has no file for something that is not in the library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/playback/22222222-2222-4222-8222-222222222222/file`,
    );

    expect(response.status).toBe(404);
  });
});

describe('the seek-bar previews', () => {
  it('draws a single frame at a moment in the film', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/playback/${MEDIA_ID}/frame?seconds=30&width=320`,
    );

    expect(response.status).toBe(200);
  });

  it('has no frame for something that is not in the library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/playback/22222222-2222-4222-8222-222222222222/frame?seconds=30&width=320`,
    );

    expect(response.status).toBe(404);
  });

  it('sends a preview clip whole', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/preview`);

    expect(response.status).toBe(200);
  });

  it('sends the part of a preview clip that was asked for', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/preview`, {
      headers: { range: 'bytes=0-3' },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-3/4');
  });

  it('has no clip for something that is not in the library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/media/22222222-2222-4222-8222-222222222222/preview`,
    );

    expect(response.status).toBe(404);
  });

  it('offers a sheet of thumbnails, and the index that places them', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/playback/${MEDIA_ID}/trickplay`, {
      method: 'POST',
      headers: { origin: BASE },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'thumbs' });
  });
});

describe('telling presence what is being watched', () => {
  it('records what a tab started, so an admin can see it', async () => {
    const presence = createPresenceService();
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService({
          libraries: [],
          media: [
            {
              id: MEDIA_ID,
              libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
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
              audioStreams: [],
              subtitleStreams: [],
              addedAt: '2026-08-10T00:00:00.000Z',
              metadata: { hasPoster: true, hasBackdrop: false, hasLogo: false },
            },
          ],
        }),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService({
          media: { [MEDIA_ID]: hdrMedia },
          sessions: {},
        }),
        presence,
      }),
      { store, permissions, isAdministrator: true },
    );

    presence.connect('tab-1', null, null, 'Chrome on macOS', () => {});

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        clientId: 'tab-1',
      }),
    );

    expect(response.status).toBe(200);
    expect(presence.list()[0]?.playback).toMatchObject({
      mediaId: MEDIA_ID,
      mediaTitle: 'Arrival',
      hasPoster: true,
    });
  });

  it('says nothing to presence about a tab that never said which one it is', async () => {
    const { app } = build();

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: capableProfile }),
    );

    expect(response.status).toBe(200);
  });

  it('tells presence a conversion is a conversion, not a direct play', async () => {
    const inTheLibrary: MediaDetail = {
      id: MEDIA_ID,
      libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
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
      audioStreams: [],
      subtitleStreams: [],
      addedAt: '2026-08-10T00:00:00.000Z',
      metadata: { hasPoster: false, hasBackdrop: true, hasLogo: false },
    };

    const presence = createPresenceService();
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: createMemoryLibraryService({ libraries: [], media: [inTheLibrary] }),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        ratings: createMemoryRatingService(),
        playback: createMemoryPlaybackService({
          media: { [MEDIA_ID]: hdrMedia },
          sessions: {},
        }),
        presence,
      }),
      { store, permissions, isAdministrator: true },
    );

    presence.connect('tab-1', null, null, 'Chrome on macOS', () => {});

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: modestProfile,
        clientId: 'tab-1',
      }),
    );

    expect(response.status).toBe(200);
    expect(presence.list()[0]?.playback).toMatchObject({
      mode: 'transcode',
      hasBackdrop: true,
    });
  });

  it('says nothing to presence about an item the library does not hold', async () => {
    const presence = createPresenceService();
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();

    const app = signedInApp(
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
        playback: createMemoryPlaybackService({
          media: { [MEDIA_ID]: hdrMedia },
          sessions: {},
        }),
        presence,
      }),
      { store, permissions, isAdministrator: true },
    );

    presence.connect('tab-1', null, null, 'Chrome on macOS', () => {});

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        clientId: 'tab-1',
      }),
    );

    expect(response.status).toBe(200);
    expect(presence.list()[0]?.playback).toBeNull();
  });

  it('passes on a failure the media service reported, rather than a session', async () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();
    const playback = createMemoryPlaybackService({
      media: { [MEDIA_ID]: hdrMedia },
      sessions: {},
    });

    const app = signedInApp(
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
        playback: {
          ...playback,
          start: () => Promise.resolve({ kind: 'failed', reason: 'ffmpeg would not start' }),
        },
      }),
      { store, permissions, isAdministrator: true },
    );

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: capableProfile }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'ffmpeg would not start' });
  });
});
