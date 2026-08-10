import { describe, expect, it } from 'vitest'
import TranscoderClientModule from './TranscoderClient'

const { readSocketPath, createTranscoderClient } = TranscoderClientModule

describe('readSocketPath', () => {
  it('reads a unix socket address', () => {
    expect(readSocketPath('unix:/run/flux-transcoder.sock')).toBe('/run/flux-transcoder.sock')
  })

  it('reports nothing for an http address', () => {
    expect(readSocketPath('http://127.0.0.1:8477')).toBeNull()
  })
})

describe('createTranscoderClient', () => {
  it('addresses requests to the base url over http', async () => {
    const calls: string[] = []

    const client = createTranscoderClient({
      baseUrl: 'http://127.0.0.1:8477',
      fetchImpl: (url) => {
        calls.push(url)

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ status: 'ok' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        })
      },
    })

    await client.isReachable()

    expect(calls[0]).toBe('http://127.0.0.1:8477/health')
  })

  it('uses a placeholder origin for socket requests, since a socket has none', async () => {
    const calls: string[] = []

    const client = createTranscoderClient({
      baseUrl: 'unix:/run/flux-transcoder.sock',
      fetchImpl: (url) => {
        calls.push(url)

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ status: 'ok' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        })
      },
    })

    await client.isReachable()

    expect(calls[0]).toBe('http://transcoder.local/health')
    expect(calls[0]).not.toContain('unix:')
  })

  it('reports an unreachable service rather than throwing', async () => {
    const client = createTranscoderClient({
      baseUrl: 'unix:/run/flux-transcoder.sock',
      fetchImpl: () => Promise.reject(new Error('ENOENT')),
    })

    await expect(client.isReachable()).resolves.toBe(false)
  })
})
