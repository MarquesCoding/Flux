import { describe, expect, it, vi } from 'vitest'
import AppModule from '@FluxServer/App'
import createMemoryAuthModule from '@FluxServer/auth/createMemoryAuth'
import createMemoryLibraryServiceModule from '@FluxServer/library/createMemoryLibraryService'
import createMemoryPlaybackServiceModule from '@FluxServer/playback/createMemoryPlaybackService'
import createMemorySegmentServiceModule from '@FluxServer/segments/createMemorySegmentService'
import createMemorySubtitleServiceModule from '@FluxServer/subtitles/createMemorySubtitleService'
import createMemoryWatchProgressServiceModule from '@FluxServer/progress/createMemoryWatchProgressService'
import PresenceServiceModule from './PresenceService'
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule
const { createMemoryPlaybackService } = createMemoryPlaybackServiceModule
const { createMemorySegmentService } = createMemorySegmentServiceModule
const { createMemorySubtitleService } = createMemorySubtitleServiceModule
const { createMemoryWatchProgressService } = createMemoryWatchProgressServiceModule
const { createPresenceService } = PresenceServiceModule

const BASE = 'http://localhost:8420'

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
}

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' }

const plan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
}

const build = () => {
  const { auth, settings } = createMemoryAuth()
  const presence = createPresenceService()

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
  })

  return { app, presence }
}

const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  })

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? ''
}

describe('presence over HTTP', () => {
  it('refuses a heartbeat from nobody signed in', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/presence/tab-1/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ isPlaying: true }),
    })

    expect(response.status).toBe(401)
  })

  it('refuses to say a tab stopped watching from nobody signed in', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/presence/tab-1/watching`, {
      method: 'DELETE',
      headers: { origin: BASE },
    })

    expect(response.status).toBe(401)
  })

  it('says a tab has stopped watching', async () => {
    const { app, presence } = build()
    const cookie = await signedIn(app)

    presence.connect('tab-1', null, null, 'Chrome on macOS', vi.fn())
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan,
    })

    const response = await app.request(`${BASE}/api/presence/tab-1/watching`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(204)
    expect(presence.list()).toMatchObject([{ clientId: 'tab-1', playback: null }])
  })

  it('does not clear presence when a session is stopped for an ordinary reason, like a quality change', async () => {
    const { app, presence } = build()
    const cookie = await signedIn(app)

    presence.connect('tab-1', null, null, 'Chrome on macOS', vi.fn())
    presence.startPlayback('tab-1', {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      transcoderSessionId: null,
      plan,
    })

    // The same DELETE a quality or track change fires to tear the old
    // session down before starting a new one. It must never be mistaken for
    // the viewer leaving — that is what the dedicated route above is for.
    await app.request(`${BASE}/api/playback/session/direct-media-1`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    })

    expect(presence.list()).toMatchObject([
      { clientId: 'tab-1', playback: { mediaTitle: 'Arrival' } },
    ])
  })
})
