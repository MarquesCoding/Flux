import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import currentProfileModule from './currentProfile'

const { readCurrentProfile, writeCurrentProfile, profileHeaders, STORAGE_KEY } =
  currentProfileModule

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readCurrentProfile', () => {
  it('says nobody has been chosen on a device nobody has chosen on', () => {
    expect(readCurrentProfile()).toBeNull()
  })

  it('reads back who was chosen', () => {
    writeCurrentProfile('abc')

    expect(readCurrentProfile()).toBe('abc')
  })

  it('says nobody rather than failing where storage is refused', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })

    expect(readCurrentProfile()).toBeNull()
  })
})

describe('writeCurrentProfile', () => {
  it('remembers on the device rather than on the account', () => {
    writeCurrentProfile('abc')

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('abc')
  })

  it('forgets when nobody is watching', () => {
    writeCurrentProfile('abc')
    writeCurrentProfile(null)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('carries on where storage is refused, rather than stopping anybody watching', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('private mode')
    })

    expect(() => {
      writeCurrentProfile('abc')
    }).not.toThrow()
  })
})

describe('profileHeaders', () => {
  it('says who is watching', () => {
    writeCurrentProfile('abc')

    expect(profileHeaders()).toEqual({ 'x-flux-profile': 'abc' })
  })

  it('says nothing when nobody has been chosen, rather than naming nobody', () => {
    expect(profileHeaders()).toEqual({})
  })
})
