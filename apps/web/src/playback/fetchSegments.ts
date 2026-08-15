import { z } from 'zod';
import { MediaSegmentSchema } from '@FluxContracts/schemas/MediaSegment';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

const SegmentListSchema = z.object({ segments: z.array(MediaSegmentSchema) });

const OFFER_SECONDS = 12;

/**
 * Reads what is known about an item's intro, recap and credits.
 */
const fetchSegments = async (mediaId: string): Promise<MediaSegment[]> => {
  try {
    const response = await fetch(`/api/media/${mediaId}/segments`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return SegmentListSchema.parse(await response.json()).segments;
  } catch {
    return [];
  }
};

/**
 * The segment worth offering to skip at this moment, if any.
 */
const skippableAt = (segments: MediaSegment[], positionSeconds: number): MediaSegment | null =>
  segments.find(
    (segment) =>
      segment.kind !== 'preview' &&
      positionSeconds >= segment.startSeconds &&
      positionSeconds < Math.min(segment.startSeconds + OFFER_SECONDS, segment.endSeconds),
  ) ?? null;

/**
 * What the button says.
 */
const describeSkip = (segment: MediaSegment): string => {
  if (segment.kind === 'recap') {
    return 'Skip Recap';
  }

  if (segment.kind === 'credits') {
    return 'Skip Credits';
  }

  return 'Skip Intro';
};

export type { MediaSegment };

export { fetchSegments, skippableAt, describeSkip, OFFER_SECONDS };
