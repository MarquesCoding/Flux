import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import clientIdentityModule from './clientIdentity'

const { readClientId } = clientIdentityModule

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readClientId', () => {
  it('makes an id for a tab that has none yet', () => {
    expect(readClientId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps the same id across calls in the same tab', () => {
    expect(readClientId()).toBe(readClientId())
  })

  it('still answers when storage is refused, just without remembering it', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })

    expect(() => readClientId()).not.toThrow()
  })
})
