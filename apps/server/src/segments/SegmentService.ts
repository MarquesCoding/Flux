import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

type SegmentService = {
  list: (mediaId: string) => Promise<MediaSegment[]>;
  replace: (mediaId: string, segments: MediaSegment[]) => Promise<void>;
};

export type { SegmentService };
