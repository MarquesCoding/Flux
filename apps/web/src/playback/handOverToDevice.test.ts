import { describe, expect, it, vi } from 'vitest'
import handOverToDeviceModule from './handOverToDevice'

const { handOverToDevice } = handOverToDeviceModule

const REACHABLE = 'http://flux.local:5173'

/**
 * A video element that can be handed to a device, as Chrome presents one.
 */
const castable = (isRefused = false) => {
  const element = document.createElement('video')

  Object.defineProperty(element, 'remote', {
    configurable: true,
    value: {
      state: 'disconnected',
      prompt: vi.fn(() => (isRefused ? Promise.reject(new Error('no')) : Promise.resolve())),
      watchAvailability: vi.fn(() => Promise.resolve(1)),
      cancelWatchAvailability: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })

  return element
}

describe('handOverToDevice', () => {
  it('points the element at an address a device can fetch', async () => {
    const element = castable()

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
    })

    expect(element.src).toBe('http://flux.local:5173/api/playback/session/abc/index.m3u8')
  })

  it('lets go of the media engine first', async () => {
    const element = castable()
    const release = vi.fn(() => Promise.resolve())

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
      release,
    })

    // A device fetches the stream itself, which cannot happen while an engine
    // here is feeding the same element.
    expect(release).toHaveBeenCalled()
  })

  it('carries on from where the viewer was', async () => {
    const element = castable()

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      writable: true,
      value: 812,
    })

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
    })

    expect(element.currentTime).toBe(812)
  })

  it('refuses where the page is at an address nothing else can follow', async () => {
    const element = castable()
    const release = vi.fn(() => Promise.resolve())

    const shown = await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: 'http://localhost:5173',
      release,
    })

    // Nothing torn down, so a viewer who cannot cast is left watching what
    // they were watching.
    expect(shown).toBe(false)
    expect(release).not.toHaveBeenCalled()
  })

  it('says so when the picker was dismissed', async () => {
    const element = castable(true)

    await expect(
      handOverToDevice({
        element,
        url: '/api/playback/session/abc/index.m3u8',
        origin: REACHABLE,
      }),
    ).resolves.toBe(false)
  })
})
