import { z } from 'zod';

const SEGMENT_KINDS = ['intro', 'recap', 'credits', 'preview'] as const;

const SegmentKindSchema = z.enum(SEGMENT_KINDS);

const SEGMENT_SOURCES = ['chapters', 'fingerprint', 'manual'] as const;

const SegmentSourceSchema = z.enum(SEGMENT_SOURCES);

const MediaSegmentSchema = z.object({
  kind: SegmentKindSchema,
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  source: SegmentSourceSchema,
});

type MediaSegment = z.infer<typeof MediaSegmentSchema>;
type SegmentKind = z.infer<typeof SegmentKindSchema>;
type SegmentSource = z.infer<typeof SegmentSourceSchema>;

export type { MediaSegment, SegmentKind, SegmentSource };

export {
  MediaSegmentSchema,
  SegmentKindSchema,
  SegmentSourceSchema,
  SEGMENT_KINDS,
  SEGMENT_SOURCES,
};
