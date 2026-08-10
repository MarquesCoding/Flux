import { afterEach, describe, expect, it, vi } from 'vitest'
import qualityPreferenceModule from './qualityPreference'

const { readQualityPreference, saveQualityPreference, DEFAULT_QUALITY_PREFERENCE } =
  qualityPreferenceModule

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('readQualityPreference', () => {
  it('answers with Original when nothing has been chosen', () => {
    expect(readQualityPreference()).toBe(DEFAULT_QUALITY_PREFERENCE)
  })

  it('reads back what was saved', () => {
    saveQualityPreference('720p')

    expect(readQualityPreference()).toBe('720p')
  })

  it('falls back to Original on a stale setting', () => {
    window.localStorage.setItem('flux.qualityPreference', '8k')

    expect(readQualityPreference()).toBe(DEFAULT_QUALITY_PREFERENCE)
  })
})

describe('saveQualityPreference', () => {
  it('does not fail when a browser refuses to store anything', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage is full.')
      },
    })

    expect(() => {
      saveQualityPreference('480p')
    }).not.toThrow()
  })
})
