import { describe, expect, it } from 'vitest'
import AppModule from './App'
import createMemoryAuthModule from './auth/createMemoryAuth'
import createMemoryLibraryServiceModule from './library/createMemoryLibraryService'
import createMemoryPlaybackServiceModule from './playback/createMemoryPlaybackService'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule
const { createMemoryPlaybackService } = createMemoryPlaybackServiceModule

const { auth, settings } = createMemoryAuth()
const app = createApp({
  auth,
  settings,
  countUsers: () => Promise.resolve(1),
  promoteToAdmin: () => Promise.resolve(),
  library: createMemoryLibraryService(),
  playback: createMemoryPlaybackService(),
})

describe('createApp', () => {
  it('serves health', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok' })
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
