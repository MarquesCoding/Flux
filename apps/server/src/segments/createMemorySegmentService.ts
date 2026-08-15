import type { SegmentService } from './SegmentService';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

type MemoryState = Record<string, MediaSegment[]>;

/**
 * Segments held in memory, so the HTTP surface can be tested without a database.
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
