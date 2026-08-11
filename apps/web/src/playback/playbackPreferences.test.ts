import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import playbackPreferencesModule from './playbackPreferences'

const { readPlaybackPreferences, writePlaybackPreferences, STORAGE_KEY, SUBTITLES_OFF, DEFAULTS } =
  playbackPreferencesModule

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readPlaybackPreferences', () => {
  it('starts a device at full volume, unmuted, with nothing said about subtitles', () => {
    expect(readPlaybackPreferences()).toEqual(DEFAULTS)
  })

  it('reads back what was written', () => {
    writePlaybackPreferences({ volume: 0.4, isMuted: true })

    expect(readPlaybackPreferences()).toMatchObject({ volume: 0.4, isMuted: true })
  })

  it('falls back rather than failing on a setting from an older version', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 'loud' }))

    expect(readPlaybackPreferences()).toEqual(DEFAULTS)
  })

  it('falls back rather than failing on something that is not a setting at all', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json')

    expect(readPlaybackPreferences()).toEqual(DEFAULTS)
  })

  it('falls back where a browser refuses storage, since private mode is not a fault', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })

    expect(readPlaybackPreferences()).toEqual(DEFAULTS)
  })

  it('refuses a volume outside what a volume can be', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULTS, volume: 4 }))

    expect(readPlaybackPreferences()).toEqual(DEFAULTS)
  })
})

describe('writePlaybackPreferences', () => {
  it('keeps what it was not asked to change', () => {
    writePlaybackPreferences({ volume: 0.3 })
    writePlaybackPreferences({ isMuted: true })

    expect(readPlaybackPreferences()).toMatchObject({ volume: 0.3, isMuted: true })
  })

  it('remembers a language, which is the part of a subtitle choice another file can honour', () => {
    writePlaybackPreferences({ subtitleLanguage: 'en' })

    expect(readPlaybackPreferences().subtitleLanguage).toBe('en')
  })

  it('remembers being turned off, which is not the same as never having said', () => {
    writePlaybackPreferences({ subtitleLanguage: SUBTITLES_OFF })

    expect(readPlaybackPreferences().subtitleLanguage).toBe(SUBTITLES_OFF)
    expect(DEFAULTS.subtitleLanguage).toBeNull()
  })

  it('remembers a clock that counts down', () => {
    writePlaybackPreferences({ showsRemaining: true })

    expect(readPlaybackPreferences().showsRemaining).toBe(true)
  })

  it('carries on where storage is refused, rather than stopping the film', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('private mode')
    })

    expect(() => {
      writePlaybackPreferences({ volume: 0.5 })
    }).not.toThrow()
  })

  it('writes a whole set, so nothing reads a half-written one', () => {
    writePlaybackPreferences({ volume: 0.5 })

    expect(Object.keys(readPlaybackPreferences()).sort()).toEqual(Object.keys(DEFAULTS).sort())
  })
})
