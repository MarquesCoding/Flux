import type { WatchProgressService } from './WatchProgressService'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'

type MemoryState = Record<string, WatchProgress[]>

/**
 * Watch progress held in memory, so the HTTP surface can be exercised without
 * a database.
 */
const createMemoryWatchProgressService = (
  state: MemoryState = {},
): WatchProgressService & { state: MemoryState } => ({
  state,

  list: (userId) => Promise.resolve(state[userId] ?? []),

  record: (userId, report) => {
    const existing = (state[userId] ?? []).filter((entry) => entry.mediaId !== report.mediaId)

    state[userId] = [{ ...report, updatedAt: new Date(0).toISOString() }, ...existing]

    return Promise.resolve()
  },

  forget: (userId, mediaId) => {
    state[userId] = (state[userId] ?? []).filter((entry) => entry.mediaId !== mediaId)

    return Promise.resolve()
  },
})

export type { MemoryState }

export { createMemoryWatchProgressService }
