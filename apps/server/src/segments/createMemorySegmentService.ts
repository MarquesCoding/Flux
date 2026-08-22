import type { SegmentService } from './SegmentService';
import type { MediaSegment } from '@ValenceContracts/schemas/MediaSegment';

type MemoryState = Record<string, MediaSegment[]>;

/**
 * Segments held in memory, so the routes can be exercised without Postgres.
 *
 * @param state - Any segments already marked.
 * @returns The segment service.
 */
const createMemorySegmentService = (
  state: MemoryState = {},
): SegmentService & {
  state: MemoryState;
} => ({
  state,

  list: (mediaId) => Promise.resolve(state[mediaId] ?? []),

  replace: (mediaId, segments) => {
    state[mediaId] = segments;

    return Promise.resolve();
  },
});

export type { MemoryState };

export { createMemorySegmentService };
