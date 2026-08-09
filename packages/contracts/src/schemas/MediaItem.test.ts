import { describe, expect, it } from 'vitest'
import MediaItemModule from './MediaItem'

const { MediaItemSchema } = MediaItemModule

const validItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  year: 2021,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, language: 'eng', isAtmos: true }],
  subtitleStreams: [{ index: 2, format: 'pgs', language: 'eng', isForced: false }],
}

describe('MediaItemSchema', () => {
  it('accepts a fully specified item', () => {
    const result = MediaItemSchema.parse(validItem)

    expect(result.title).toBe('Sample Film')
    expect(result.audioStreams[0]?.isAtmos).toBe(true)
  })

  it('accepts an item with no subtitle streams', () => {
    const result = MediaItemSchema.parse({ ...validItem, subtitleStreams: [] })

    expect(result.subtitleStreams).toHaveLength(0)
  })

  it('rejects an item with no audio streams', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, audioStreams: [] })).toThrow()
  })

  it('rejects an unknown container', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, container: 'rmvb' })).toThrow()
  })

  it('rejects a non-uuid id', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, id: 'not-a-uuid' })).toThrow()
  })

  it('rejects a zero duration', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, durationSeconds: 0 })).toThrow()
  })
})
