import { z } from 'zod';

/**
 * The kinds of stretch worth marking.
 *
 * An intro is the thing a viewer skips; a recap is the thing they skip on a
 * rewatch; credits are where "next episode" belongs. Each is a range with a
 * meaning rather than a bare bookmark, because what the player offers depends
 * on which it is.
 */
const SEGMENT_KINDS = ['intro', 'recap', 'credits', 'preview'] as const;

const SegmentKindSchema = z.enum(SEGMENT_KINDS);

/**
 * How a segment came to be known.
 *
 * Kept because the two sources deserve different trust: a chapter named
 * "Intro" was written by a human and is exact, while a detected range is a
 * measurement that several episodes agreed on.
 */
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
