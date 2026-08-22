import type { MediaSegment } from '@ValenceContracts/schemas/MediaSegment';

type SegmentService = {
  list: (mediaId: string) => Promise<MediaSegment[]>;
  replace: (mediaId: string, segments: MediaSegment[]) => Promise<void>;
};

export type { SegmentService };
