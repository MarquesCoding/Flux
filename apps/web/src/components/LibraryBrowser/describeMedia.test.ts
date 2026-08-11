import { describe, expect, it } from 'vitest'
import describeMediaModule from './describeMedia'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { describeMedia } = describeMediaModule

const media = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 6960,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  ...overrides,
})

describe('describeMedia', () => {
  it('shows the year and runtime', () => {
    expect(describeMedia(media())).toBe('2016 · 1:56:00')
  })

  it('omits a missing year rather than showing a placeholder', () => {
    expect(describeMedia(media({ year: null }))).toBe('1:56:00')
  })
})
