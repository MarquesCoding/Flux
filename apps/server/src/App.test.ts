import { describe, expect, it } from 'vitest'
import { createApp } from './App'
import { createMemoryAuth } from './auth/createMemoryAuth'
import { createMemoryLibraryService } from './library/createMemoryLibraryService'
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService'
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService'
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService'
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService'
import { createMemoryPlaybackService } from './playback/createMemoryPlaybackService'

const { auth, settings } = createMemoryAuth()
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
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
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
