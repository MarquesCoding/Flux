import type { FavouriteService } from './FavouriteService'
import type { Favourite } from '@FluxContracts/schemas/Favourite'

type MemoryState = Record<string, Favourite[]>

/**
 * Favourites held in memory, so the HTTP surface can be exercised without a
 * database.
 */
const createMemoryFavouriteService = (
  state: MemoryState = {},
): FavouriteService & { state: MemoryState } => ({
  state,

  list: (profileId) => Promise.resolve(state[profileId] ?? []),

  keep: (profileId, mediaId) => {
    const kept = state[profileId] ?? []

    if (!kept.some((entry) => entry.mediaId === mediaId)) {
      state[profileId] = [{ mediaId, keptAt: new Date(0).toISOString() }, ...kept]
    }

    return Promise.resolve()
  },

  drop: (profileId, mediaId) => {
    state[profileId] = (state[profileId] ?? []).filter((entry) => entry.mediaId !== mediaId)

    return Promise.resolve()
  },
})

export type { MemoryState }

export default { createMemoryFavouriteService }
