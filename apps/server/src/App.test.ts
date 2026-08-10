import { describe, expect, it } from 'vitest'
import AppModule from './App'
import createMemoryAuthModule from './auth/createMemoryAuth'
import createMemoryLibraryServiceModule from './library/createMemoryLibraryService'
import createMemorySegmentServiceModule from '@FluxServer/segments/createMemorySegmentService'
import createMemorySubtitleServiceModule from '@FluxServer/subtitles/createMemorySubtitleService'
import createMemoryPlaybackServiceModule from './playback/createMemoryPlaybackService'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule
const { createMemoryPlaybackService } = createMemoryPlaybackServiceModule
const { createMemorySubtitleService } = createMemorySubtitleServiceModule
const { createMemorySegmentService } = createMemorySegmentServiceModule

const { auth, settings } = createMemoryAuth()
const app = createApp({
  auth,
  settings,
  countUsers: () => Promise.resolve(1),
  promoteToAdmin: () => Promise.resolve(),
  library: createMemoryLibraryService(),
  subtitles: createMemorySubtitleService(),
  segments: createMemorySegmentService(),
  playback: createMemoryPlaybackService(),
})

describe('createApp', () => {
  it('reports degraded when the media service cannot be reached', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      transcoderReachable: false,
    })
  })

  it('reports ok when the media service answers', async () => {
    const { auth, settings } = createMemoryAuth()
    const healthy = createApp({
      auth,
      settings,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService(),
      subtitles: createMemorySubtitleService(),
      segments: createMemorySegmentService(),
      playback: createMemoryPlaybackService(),
      isTranscoderReachable: () => Promise.resolve(true),
    })

    const response = await healthy.request('/api/health')

    expect(await response.json()).toMatchObject({ status: 'ok', transcoderReachable: true })
  })

  it('serves an OpenAPI 3.1 document', async () => {
    const response = await app.request('/api/openapi.json')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ openapi: '3.1.0', info: { title: 'Flux API' } })
  })

  it('documents the playback endpoints in the specification', async () => {
    const response = await app.request('/api/openapi.json')
    const body = await response.json()

    expect(body).toHaveProperty(['paths', '/api/playback/{mediaId}/session', 'post'])
    expect(body).toHaveProperty(['paths', '/api/playback/{mediaId}/explain', 'post'])
  })

  it('serves the Scalar API reference', async () => {
    const response = await app.request('/api/reference')

    expect(response.status).toBe(200)
  })
})
