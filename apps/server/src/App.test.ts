import { describe, expect, it } from 'vitest'
import AppModule from './App'
import createMemoryAuthModule from './auth/createMemoryAuth'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule

const app = createApp({ auth: createMemoryAuth() })

const deviceProfile = {
  schemaVersion: 1,
  name: 'Test client',
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

  it('documents the explain endpoint in the specification', async () => {
    const response = await app.request('/api/openapi.json')
    const body = await response.json()

    expect(body).toHaveProperty(['paths', '/api/playback/explain', 'post'])
  })

  it('explains a playback plan without starting a session', async () => {
    const response = await app.request('/api/playback/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        deviceProfile,
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      mode: 'Transcode',
      plan: { video: { kind: 'transcode' } },
    })
  })

  it('rejects an explain request with an invalid device profile', async () => {
    const response = await app.request('/api/playback/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        deviceProfile: { ...deviceProfile, directPlayProfiles: [] },
      }),
    })

    expect(response.status).toBe(400)
  })

  it('serves the Scalar API reference', async () => {
    const response = await app.request('/api/reference')

    expect(response.status).toBe(200)
  })
})
