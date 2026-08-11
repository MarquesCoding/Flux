import { describe, expect, it } from 'vitest'
import AppModule from '@FluxServer/App'
import createMemoryAuthModule from '@FluxServer/auth/createMemoryAuth'
import createMemoryLibraryServiceModule from '@FluxServer/library/createMemoryLibraryService'
import createMemoryWatchProgressServiceModule from '@FluxServer/progress/createMemoryWatchProgressService'
import createMemoryFavouriteServiceModule from '@FluxServer/favourites/createMemoryFavouriteService'
import createMemorySegmentServiceModule from '@FluxServer/segments/createMemorySegmentService'
import createMemorySubtitleServiceModule from '@FluxServer/subtitles/createMemorySubtitleService'
import createMemoryPlaybackServiceModule from './createMemoryPlaybackService'
import { z } from 'zod'
import PlaybackPlanModule from '@FluxContracts/schemas/PlaybackPlan'
import type { MediaItem } from '@FluxContracts/schemas/MediaItem'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule
const { createMemoryPlaybackService } = createMemoryPlaybackServiceModule
const { createMemorySubtitleService } = createMemorySubtitleServiceModule
const { createMemorySegmentService } = createMemorySegmentServiceModule
const { createMemoryWatchProgressService } = createMemoryWatchProgressServiceModule
const { createMemoryFavouriteService } = createMemoryFavouriteServiceModule

const { PlaybackPlanSchema } = PlaybackPlanModule

const ExplainSchema = z.object({ mode: z.string(), plan: PlaybackPlanSchema })

const StartSchema = z.object({
  sessionId: z.string(),
  delivery: z.union([
    z.object({ kind: z.literal('hls'), manifestUrl: z.string() }),
    z.object({ kind: z.literal('direct'), url: z.string() }),
  ]),
  mode: z.string(),
  plan: PlaybackPlanSchema,
  warnings: z.array(z.string()),
})

const BASE = 'http://localhost:8420'
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9'
const MISSING_ID = '00000000-0000-4000-8000-000000000000'

const hdrMedia: MediaItem = {
  id: MEDIA_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: true }],
  subtitleStreams: [],
}

const modestProfile = {
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 1920,
  maxHeight: 1080,
  maxBitrateKbps: 8000,
  maxAudioChannels: 2,
  supportedVideoRanges: ['SDR'],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
}

const capableProfile = {
  ...modestProfile,
  name: 'Living room TV',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40000,
  maxAudioChannels: 8,
  supportedVideoRanges: ['SDR', 'HDR10'],
  directPlayProfiles: [
    { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['truehd', 'aac'] },
  ],
}

const MODEST_MEDIA_ID = '11111111-1111-4111-8111-111111111111'

const modestMedia: MediaItem = {
  id: MODEST_MEDIA_ID,
  title: 'A Modest Film',
  year: 2020,
  container: 'mkv',
  durationSeconds: 6000,
  videoCodec: 'h264',
  videoRange: 'SDR',
  width: 1920,
  height: 1080,
  bitrateKbps: 3000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
}

const build = (options: { unsupported?: boolean } = {}) => {
  const { auth, settings } = createMemoryAuth()
  const playback = createMemoryPlaybackService({
    media: { [MEDIA_ID]: hdrMedia, [MODEST_MEDIA_ID]: modestMedia },
    sessions: {},
    ...(options.unsupported === true ? { unsupported: true } : {}),
  })

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
    playback,
  })

  return { app, playback }
}

const post = (path: string, body: object) =>
  new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(body),
  })

describe('playback explain', () => {
  it('explains a real library item', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ mode: 'Transcode' })
  })

  it('explains why, on every axis', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }),
    )
    const body = ExplainSchema.parse(await response.json())

    expect(body.plan.video.reason.code).toBe('VideoCodecNotSupported')
    expect(body.plan.audio.reason.code).toBe('AudioCodecNotSupported')
    expect(body.plan.container.reason.detail).toBeTruthy()
  })

  it('reports direct play for a capable client', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: capableProfile }),
    )

    expect(await response.json()).toMatchObject({ mode: 'DirectPlay' })
  })

  it('starts nothing when only explaining', async () => {
    const { app, playback } = build()

    await app.request(post(`/api/playback/${MEDIA_ID}/explain`, { deviceProfile: modestProfile }))

    expect(Object.keys(playback.state.sessions)).toHaveLength(0)
  })

  it('reports an unknown item', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MISSING_ID}/explain`, { deviceProfile: modestProfile }),
    )

    expect(response.status).toBe(404)
  })

  it('rejects an invalid device profile', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/explain`, {
        deviceProfile: { ...modestProfile, directPlayProfiles: [] },
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('playback sessions', () => {
  it('starts a session and returns a manifest url', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    )
    const body = StartSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.delivery.kind).toBe('hls')
    expect(body.delivery.kind === 'hls' && body.delivery.manifestUrl).toContain(
      '/api/playback/session/',
    )
  })

  it('reports the mode and plan alongside the session', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    )
    const body = StartSchema.parse(await response.json())

    expect(body).toMatchObject({ mode: 'Transcode' })
    expect(body.plan.video.reason.code).toBe('VideoCodecNotSupported')
  })

  it('serves the manifest through the server rather than the media service', async () => {
    const { app } = build()

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    )

    const manifestUrl = started.delivery.kind === 'hls' ? started.delivery.manifestUrl : ''
    const manifest = await app.request(`${BASE}${manifestUrl}`)

    expect(manifest.status).toBe(200)
    expect(manifest.headers.get('content-type')).toContain('mpegurl')
    expect(await manifest.text()).toContain('#EXTM3U')
  })

  it('reports an unknown session file', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/playback/session/nope/index.m3u8`)

    expect(response.status).toBe(404)
  })

  it('reports an unknown item', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MISSING_ID}/session`, { deviceProfile: modestProfile }),
    )

    expect(response.status).toBe(404)
  })

  it('reports when the server cannot produce a playable stream', async () => {
    const { app } = build({ unsupported: true })

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
    )

    expect(response.status).toBe(422)
    expect(z.object({ error: z.string() }).safeParse(await response.json()).success).toBe(true)
  })

  it('stops a session', async () => {
    const { app, playback } = build()

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    )

    const response = await app.request(
      new Request(`${BASE}/api/playback/session/${started.sessionId}`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(204)
    expect(Object.keys(playback.state.sessions)).toHaveLength(0)
  })

  it('reports stopping an unknown session', async () => {
    const { app } = build()

    const response = await app.request(
      new Request(`${BASE}/api/playback/session/nope`, { method: 'DELETE' }),
    )

    expect(response.status).toBe(404)
  })

  it('accepts a heartbeat for a running session', async () => {
    const { app } = build()

    const started = StartSchema.parse(
      await (
        await app.request(
          post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
        )
      ).json(),
    )

    const response = await app.request(
      post(`/api/playback/session/${started.sessionId}/heartbeat`, { isPlaying: false }),
    )

    expect(response.status).toBe(204)
  })

  it('reports a heartbeat for an unknown session', async () => {
    const { app } = build()

    const response = await app.request(
      post('/api/playback/session/nope/heartbeat', { isPlaying: true }),
    )

    expect(response.status).toBe(404)
  })

  it('accepts a seek position', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: modestProfile,
        startSeconds: 120,
      }),
    )

    expect(response.status).toBe(200)
  })
})

describe('trickplay', () => {
  it('reports where the seek-bar previews live', async () => {
    const { app } = build()

    const response = await app.request(post(`/api/playback/${MEDIA_ID}/trickplay`, {}))

    const body = z
      .object({ url: z.string(), tileWidth: z.number(), tileHeight: z.number() })
      .parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.url).toContain('.vtt')
    expect(body).toMatchObject({ tileWidth: 320, tileHeight: 180 })
  })

  it('refuses previews for an item that does not exist', async () => {
    const { app } = build()

    const response = await app.request(post(`/api/playback/${MISSING_ID}/trickplay`, {}))

    expect(response.status).toBe(404)
  })

  it('serves the index the url points at', async () => {
    const { app } = build()

    const started = await app.request(post(`/api/playback/${MEDIA_ID}/trickplay`, {}))
    const { url } = z.object({ url: z.string() }).parse(await started.json())

    const response = await app.request(new Request(`${BASE}${url}`))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/vtt')
    expect(await response.text()).toContain('WEBVTT')
  })

  it('answers with a not found rather than an empty body for a missing sheet', async () => {
    const { app } = build()

    const response = await app.request(
      new Request(`${BASE}/api/playback/trickplay/thumbs/sheet-999.jpg`),
    )

    expect(response.status).toBe(404)
  })

  describe('audio tracks', () => {
    it('starts an ordinary session when no track was asked for', async () => {
      const { app } = build()

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, { deviceProfile: modestProfile }),
      )
      const body = StartSchema.parse(await response.json())

      expect(body.sessionId).not.toContain('audio')
    })

    it('starts a different session for a different track', async () => {
      const { app } = build()

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, {
          deviceProfile: modestProfile,
          audioStreamIndex: 2,
        }),
      )
      const body = StartSchema.parse(await response.json())

      expect(response.status).toBe(200)
      expect(body.sessionId).toContain('audio-2')
    })

    it('refuses a track index that is not one', async () => {
      const { app } = build()

      const response = await app.request(
        post(`/api/playback/${MEDIA_ID}/session`, {
          deviceProfile: modestProfile,
          audioStreamIndex: -1,
        }),
      )

      expect(response.status).toBe(400)
    })

    it('documents the choice in the specification', async () => {
      const { app } = build()
      const body = await (await app.request(`${BASE}/api/openapi.json`)).json()

      expect(body).toHaveProperty([
        'components',
        'schemas',
        'PlaybackStartRequest',
        'properties',
        'audioStreamIndex',
      ])
    })
  })
})

describe('quality steps', () => {
  it('forces a resolution and bitrate clamp the device alone would not require', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '720p',
      }),
    )
    const body = StartSchema.parse(await response.json())

    expect(body.plan.video).toMatchObject({
      kind: 'transcode',
      maxWidth: 1280,
      maxHeight: 720,
      maxBitrateKbps: 2500,
    })
    expect(body.plan.video.reason.code).toBe('UserForcedTranscode')
  })

  it('leaves audio alone at 720p', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '720p',
      }),
    )
    const body = StartSchema.parse(await response.json())

    expect(body.plan.audio.kind).toBe('passthrough')
  })

  it('compresses audio below 720p', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '480p',
      }),
    )
    const body = StartSchema.parse(await response.json())

    expect(body.plan.audio).toMatchObject({ kind: 'transcode', maxBitrateKbps: 128 })
    expect(body.plan.audio.reason.code).toBe('UserForcedTranscode')
  })

  it('treats a step that would not reduce anything as Original', async () => {
    const { app } = build()

    const response = await app.request(
      post(`/api/playback/${MODEST_MEDIA_ID}/session`, {
        deviceProfile: capableProfile,
        requestedQuality: '1080p',
      }),
    )
    const body = StartSchema.parse(await response.json())

    expect(body.mode).toBe('DirectPlay')
    expect(body.plan.video.kind).toBe('passthrough')
    expect(body.plan.audio.kind).toBe('passthrough')
  })

  it('documents the choice in the specification', async () => {
    const { app } = build()
    const body = await (await app.request(`${BASE}/api/openapi.json`)).json()

    expect(body).toHaveProperty([
      'components',
      'schemas',
      'PlaybackStartRequest',
      'properties',
      'requestedQuality',
    ])
  })
})
