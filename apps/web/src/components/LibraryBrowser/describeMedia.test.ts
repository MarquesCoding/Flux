import { describe, expect, it } from 'vitest'
import describeMediaModule from './describeMedia'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { describeMedia, describeBadges } = describeMediaModule

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

describe('describeBadges', () => {
  it('calls a 4K file 4K', () => {
    expect(describeBadges(media({ width: 3840, height: 2160 }))).toContain('4K')
  })

  it('calls a 1080p file 1080p', () => {
    expect(describeBadges(media())).toContain('1080p')
  })

  it('calls a 720p file 720p', () => {
    expect(describeBadges(media({ width: 1280, height: 720 }))).toContain('720p')
  })

  it('says nothing about resolution below 720p', () => {
    expect(describeBadges(media({ width: 640, height: 480 }))).toEqual([])
  })

  it('shows the dynamic range when it is not SDR', () => {
    expect(describeBadges(media({ videoRange: 'HDR10' }))).toContain('HDR10')
  })

  it('does not label SDR, which is the default rather than a feature', () => {
    expect(describeBadges(media())).not.toContain('SDR')
  })

  it('shows both resolution and range together', () => {
    expect(describeBadges(media({ width: 3840, height: 2160, videoRange: 'DolbyVision' }))).toEqual(
      ['4K', 'DolbyVision'],
    )
  })
})
