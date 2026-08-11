import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFavouritesModule from './useFavourites'

const { useFavourites } = useFavouritesModule

const fetchFavourites = vi.fn<() => Promise<string[]>>()
const setFavourite = vi.fn<(mediaId: string, isKept: boolean) => Promise<boolean>>()

vi.mock('@FluxWeb/library/fetchFavourites', () => ({
  default: {
    fetchFavourites: () => fetchFavourites(),
    setFavourite: (mediaId: string, isKept: boolean) => setFavourite(mediaId, isKept),
  },
}))

beforeEach(() => {
  fetchFavourites.mockReset().mockResolvedValue([])
  setFavourite.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFavourites', () => {
  it('reads the whole list once rather than asking per item', async () => {
    fetchFavourites.mockResolvedValue(['media-1'])

    const { result } = renderHook(() => useFavourites())

    await waitFor(() => {
      expect(result.current.isKept('media-1')).toBe(true)
    })
    expect(fetchFavourites).toHaveBeenCalledTimes(1)
  })

  it('fills the heart before the server has answered', async () => {
    let answer = (agreed: boolean) => {
      void agreed
    }

    setFavourite.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )

    const { result } = renderHook(() => useFavourites())

    await act(async () => {
      result.current.toggle('media-1')
      await Promise.resolve()
    })

    // Filled while the request is still in the air: keeping something is not a
    // transaction, and a heart that waits for a round trip feels broken on a
    // connection that is merely slow.
    await waitFor(() => {
      expect(result.current.isKept('media-1')).toBe(true)
    })

    await act(async () => {
      answer(true)
      await Promise.resolve()
    })

    expect(result.current.isKept('media-1')).toBe(true)
  })

  it('puts the heart back when the server disagrees', async () => {
    setFavourite.mockResolvedValue(false)

    const { result } = renderHook(() => useFavourites())

    await act(async () => {
      result.current.toggle('media-1')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.isKept('media-1')).toBe(false)
    })
  })

  it('stops keeping something that was kept', async () => {
    fetchFavourites.mockResolvedValue(['media-1'])

    const { result } = renderHook(() => useFavourites())

    await waitFor(() => {
      expect(result.current.isKept('media-1')).toBe(true)
    })

    await act(async () => {
      result.current.toggle('media-1')
      await Promise.resolve()
    })

    expect(result.current.isKept('media-1')).toBe(false)
    expect(setFavourite).toHaveBeenCalledWith('media-1', false)
  })
})
