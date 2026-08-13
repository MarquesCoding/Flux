import { randomUUID } from 'node:crypto';
import { decideViewing } from './decideViewing';
import type { HistoryService, Viewing } from './HistoryService';

type MemoryViewing = Viewing & { profileId: string };

type MemoryHistoryState = {
  viewings: MemoryViewing[];
};

/**
 * History held in memory, for tests and for a server started without a
 * database.
 *
 * Applies the same rules as the real one, because the rules live in
 * `decideViewing` rather than in either of them — which is the point of having
 * put them there.
 */
const createMemoryHistoryService = (
  state: MemoryHistoryState = { viewings: [] },
): HistoryService & { state: MemoryHistoryState } => {
  /**
   * A viewing without the profile it belongs to, which the caller already knows.
   */
  const shown = (one: MemoryViewing): Viewing => ({
    id: one.id,
    mediaItemId: one.mediaItemId,
    startedAt: one.startedAt,
    lastWatchedAt: one.lastWatchedAt,
    secondsWatched: one.secondsWatched,
    isFinished: one.isFinished,
  });

  return {
    state,

    record: (profileId, mediaItemId, seen) => {
      const open = state.viewings
        .filter((one) => one.profileId === profileId && one.mediaItemId === mediaItemId)
        .sort((left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt))[0];

      const decided = decideViewing(
        open === undefined
          ? null
          : {
              id: open.id,
              lastWatchedAt: new Date(open.lastWatchedAt),
              secondsWatched: open.secondsWatched,
              isFinished: open.isFinished,
            },
        seen,
      );

      if (decided.kind === 'ignore') {
        return Promise.resolve(null);
      }

      if (decided.kind === 'extend') {
        const found = state.viewings.find((one) => one.id === decided.id);

        if (found === undefined) {
          return Promise.resolve(null);
        }

        found.secondsWatched = decided.secondsWatched;
        found.isFinished = decided.isFinished;
        found.lastWatchedAt = seen.at.toISOString();

        return Promise.resolve(shown(found));
      }

      const made: MemoryViewing = {
        profileId,
        id: randomUUID(),
        mediaItemId,
        startedAt: seen.at.toISOString(),
        lastWatchedAt: seen.at.toISOString(),
        secondsWatched: decided.secondsWatched,
        isFinished: decided.isFinished,
      };

      state.viewings.push(made);

      return Promise.resolve(shown(made));
    },

    list: (profileId, options = {}) =>
      Promise.resolve(
        state.viewings
          .filter((one) => one.profileId === profileId)
          .sort((left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt))
          .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50))
          .map(shown),
      ),

    forget: (profileId, viewingId) => {
      const at = state.viewings.findIndex(
        (one) => one.id === viewingId && one.profileId === profileId,
      );

      if (at === -1) {
        return Promise.resolve(false);
      }

      state.viewings.splice(at, 1);

      return Promise.resolve(true);
    },

    forgetAll: (profileId) => {
      const before = state.viewings.length;

      state.viewings = state.viewings.filter((one) => one.profileId !== profileId);

      return Promise.resolve(before - state.viewings.length);
    },
  };
};

export type { MemoryHistoryState };

export { createMemoryHistoryService };
