import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlace } from './usePlace'

const addressNow = (): string => `${window.location.pathname}${window.location.search}`

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePlace', () => {
  it('starts wherever the address bar says', () => {
    window.history.replaceState(null, '', '/search?q=blade')

    const { result } = renderHook(() => usePlace())

    expect(result.current.place).toMatchObject({ section: 'search', search: 'blade' })
  })

  it('writes where somebody moved to into the address', () => {
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.go({ section: 'admin' })
    })

    expect(addressNow()).toBe('/admin')
  })

  it('keeps what it was not told to change', () => {
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.go({ section: 'search', search: 'blade' })
    })
    act(() => {
      result.current.go({ inspecting: 'abc' })
    })

    expect(result.current.place).toMatchObject({ search: 'blade', inspecting: 'abc' })
  })

  it('adds an entry to the history when somebody moves', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.go({ section: 'admin' })
    })

    expect(push).toHaveBeenCalledOnce()
  })

  it('replaces the entry when a place is only corrected, so typing is not a history', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.replace({ section: 'search', search: 'b' })
    })

    expect(replace).toHaveBeenCalledOnce()
    expect(push).not.toHaveBeenCalled()
  })

  it('does not record going where it already is', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.go({ section: 'home' })
    })

    expect(push).not.toHaveBeenCalled()
  })

  it('follows the back button', () => {
    const { result } = renderHook(() => usePlace())

    act(() => {
      result.current.go({ section: 'admin' })
    })

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(result.current.place.section).toBe('home')
  })

  it('stops listening once it is gone', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => usePlace())

    unmount()

    expect(remove).toHaveBeenCalledWith('popstate', expect.anything())
  })
})
