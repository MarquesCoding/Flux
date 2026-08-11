import { describe, expect, it } from 'vitest'
import readLocationModule from './readLocation'

const { readLocation, writeLocation, HOME } = readLocationModule

const at = (path: string) => readLocation(`http://flux.local${path}`)

describe('readLocation', () => {
  it('reads the root as home', () => {
    expect(at('/')).toEqual(HOME)
  })

  it('reads a section from the path', () => {
    expect(at('/admin').section).toBe('admin')
  })

  it('lands on home rather than failing on a section that does not exist', () => {
    expect(at('/nowhere').section).toBe('home')
  })

  it('reads what was searched for', () => {
    expect(at('/search?q=blade').search).toBe('blade')
  })

  it('reads an item opened over a section', () => {
    expect(at('/search?q=blade&item=abc').inspecting).toBe('abc')
  })

  it('reads an item addressed on its own', () => {
    expect(at('/media/abc').inspecting).toBe('abc')
  })

  it('reads what is being watched', () => {
    expect(at('/watch/abc').playing).toBe('abc')
  })

  it('reads where to start what is being watched', () => {
    expect(at('/watch/abc?t=930').startSeconds).toBe(930)
  })

  it('starts at the beginning when the time is not a number', () => {
    expect(at('/watch/abc?t=soon').startSeconds).toBe(0)
  })

  it('starts at the beginning rather than before it', () => {
    expect(at('/watch/abc?t=-30').startSeconds).toBe(0)
  })

  it('is not watching anything when the path names no item', () => {
    expect(at('/watch').playing).toBeNull()
  })

  it('lands on home rather than failing on an address that is not one', () => {
    expect(readLocation('not an address')).toEqual(HOME)
  })
})

describe('writeLocation', () => {
  it('writes home as the root, not as a named section', () => {
    expect(writeLocation(HOME)).toBe('/')
  })

  it('writes a section as a path', () => {
    expect(writeLocation({ ...HOME, section: 'account' })).toBe('/account')
  })

  it('writes what was searched for', () => {
    expect(writeLocation({ ...HOME, section: 'search', search: 'blade runner' })).toBe(
      '/search?q=blade+runner',
    )
  })

  it('writes an open item as a query, so closing it returns where it opened from', () => {
    expect(writeLocation({ ...HOME, section: 'search', inspecting: 'abc' })).toBe(
      '/search?item=abc',
    )
  })

  it('gives watching the path, since it is the thing worth sending somebody', () => {
    expect(writeLocation({ ...HOME, playing: 'abc' })).toBe('/watch/abc')
  })

  it('writes where to start, when it is not the beginning', () => {
    expect(writeLocation({ ...HOME, playing: 'abc', startSeconds: 930 })).toBe('/watch/abc?t=930')
  })

  it('leaves the time out when there is nothing to resume', () => {
    expect(writeLocation({ ...HOME, playing: 'abc', startSeconds: 0 })).toBe('/watch/abc')
  })

  it('writes what it can read back', () => {
    const place = {
      section: 'search',
      search: 'blade',
      inspecting: 'abc',
      playing: null,
      startSeconds: 0,
    } as const

    expect(readLocation(`http://flux.local${writeLocation(place)}`)).toEqual(place)
  })
})
