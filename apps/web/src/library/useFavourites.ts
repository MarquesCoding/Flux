import { useCallback, useEffect, useState } from 'react'
import fetchFavouritesModule from '@FluxWeb/library/fetchFavourites'

const { fetchFavourites, setFavourite } = fetchFavouritesModule

type Favourites = {
  kept: Set<string>
  isKept: (mediaId: string) => boolean
  toggle: (mediaId: string) => void
}

/**
 * What this viewer has kept, and the one gesture that changes it.
 *
 * Read once for the whole session rather than per card: a page of forty items
 * each asking whether it is kept is forty requests to draw forty hearts.
 *
 * The heart fills before the server has answered and puts itself back if the
 * server disagrees. Keeping something is not a transaction — nothing else
 * depends on it having happened — and a heart that waits for a round trip
 * feels broken on a connection that is merely slow.
 */
const useFavourites = (): Favourites => {
  const [kept, setKept] = useState<Set<string>>(new Set())

  useEffect(() => {
    void fetchFavourites().then((ids) => {
      setKept(new Set(ids))
    })
  }, [])

  const toggle = useCallback(
    (mediaId: string) => {
      const wants = !kept.has(mediaId)

      setKept((held) => {
        const next = new Set(held)

        if (wants) {
          next.add(mediaId)
        } else {
          next.delete(mediaId)
        }

        return next
      })

      void setFavourite(mediaId, wants).then((agreed) => {
        if (agreed) {
          return
        }

        setKept((held) => {
          const next = new Set(held)

          if (wants) {
            next.delete(mediaId)
          } else {
            next.add(mediaId)
          }

          return next
        })
      })
    },
    [kept],
  )

  return {
    kept,
    isKept: (mediaId) => kept.has(mediaId),
    toggle,
  }
}

export type { Favourites }

export default { useFavourites }
