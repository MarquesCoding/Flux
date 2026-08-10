import { afterEach, describe, expect, it, vi } from 'vitest'
import fetchSubtitlesModule from './fetchSubtitles'
import type { SubtitleTrack } from './fetchSubtitles'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { fetchSubtitleTracks, subtitleTrackUrl, defaultTrackId, SUBTITLES_OFF } =
  fetchSubtitlesModule

const track = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack => ({
  id: 'en',
  language: 'en',
  label: 'English',
  format: 'srt',
  isForced: false,
  isHearingImpaired: false,
  ...overrides,
})

const respondWith = (answer: { ok: boolean; body: JsonValue }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: answer.ok,
        status: answer.ok ? 200 : 404,
        json: () => Promise.resolve(answer.body),
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('subtitleTrackUrl', () => {
  it('addresses a track under the item it belongs to', () => {
    expect(subtitleTrackUrl('media-1', 'abc')).toBe('/api/media/media-1/subtitles/abc')
  })
})

describe('defaultTrackId', () => {
  it('shows a forced track without being asked', () => {
    expect(defaultTrackId([track(), track({ id: 'fr', isForced: true })])).toBe('fr')
  })

  it('stays off when nothing is forced', () => {
    expect(defaultTrackId([track()])).toBe(SUBTITLES_OFF)
  })

  it('stays off when there are no tracks at all', () => {
    expect(defaultTrackId([])).toBe(SUBTITLES_OFF)
  })
})

describe('fetchSubtitleTracks', () => {
  it('reads the tracks the server lists', async () => {
    respondWith({ ok: true, body: { tracks: [track()] } })

    await expect(fetchSubtitleTracks('media-1')).resolves.toMatchObject([{ label: 'English' }])
  })

  it('answers with nothing when the item has none', async () => {
    respondWith({ ok: false, body: null })

    await expect(fetchSubtitleTracks('media-1')).resolves.toEqual([])
  })

  it('answers with nothing rather than throwing when the server sends nonsense', async () => {
    respondWith({ ok: true, body: { tracks: [{ id: 42 }] } })

    await expect(fetchSubtitleTracks('media-1')).resolves.toEqual([])
  })
})
