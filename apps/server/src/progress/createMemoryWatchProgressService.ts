import type { WatchProgressService } from './WatchProgressService';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

type MemoryState = Record<string, WatchProgress[]>;

/**
 * Watch progress held in memory, so the routes can be exercised without Postgres.
 *
 * @param state - Any positions already recorded.
 * @returns The watch progress service.
 */
const createMemoryWatchProgressService = (
  state: MemoryState = {},
): WatchProgressService & { state: MemoryState } => ({
  state,

  list: (userId) => Promise.resolve(state[userId] ?? []),

  read: (userId, mediaId) =>
    Promise.resolve((state[userId] ?? []).find((entry) => entry.mediaId === mediaId) ?? null),

  record: (userId, report) => {
    const existing = (state[userId] ?? []).filter((entry) => entry.mediaId !== report.mediaId);

    state[userId] = [{ ...report, updatedAt: new Date(0).toISOString() }, ...existing];

    return Promise.resolve();
  },

  forget: (userId, mediaId) => {
    state[userId] = (state[userId] ?? []).filter((entry) => entry.mediaId !== mediaId);

    return Promise.resolve();
  },
});

export type { MemoryState };

export { createMemoryWatchProgressService };
