import { describe, expect, it } from 'vitest'
import { frameUrl, FRAME_WIDTH } from './frameUrl'

describe('frameUrl', () => {
  it('asks the playback service for a frame of an item', () => {
    expect(frameUrl('abc', 30)).toBe(
      `/api/playback/abc/frame?seconds=30&width=${FRAME_WIDTH.toString()}`,
    )
  })

  it('puts the moment in the address, so each frame is cached on its own', () => {
    expect(frameUrl('abc', 30)).not.toBe(frameUrl('abc', 60))
  })

  it('asks for whole seconds, since a fraction of one is not an address', () => {
    expect(frameUrl('abc', 30.7)).toContain('seconds=30')
  })

  it('never asks for a moment before the beginning', () => {
    expect(frameUrl('abc', -5)).toContain('seconds=0')
  })

  it('can be asked for a width other than the usual one', () => {
    expect(frameUrl('abc', 0, 320)).toContain('width=320')
  })
})
