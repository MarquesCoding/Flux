import { readFromServer } from '@FluxWeb/query/readFromServer';
import { z } from 'zod';
import { MediaSegmentSchema } from '@FluxContracts/schemas/MediaSegment';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

const SegmentListSchema = z.object({ segments: z.array(MediaSegmentSchema) });

const OFFER_SECONDS = 12;

/**
 * Reads what is known about an item's intro, recap and credits, so the player can offer to skip
 * them. Answers with nothing rather than throwing: skipping is an addition to watching, and a player
 * that refused to open without it would be worse than one that never offers.
 *
 * @param mediaId - The item being played.
 * @returns Its marked stretches, or none where there are any.
 */
const fetchSegments = async (mediaId: string): Promise<MediaSegment[]> => {
  return (await readFromServer(`/api/media/${mediaId}/segments`, SegmentListSchema)).segments;
};

/**
 * Finds the stretch worth offering to skip at this moment, which is the one the viewer is currently
 * inside — an offer that appears before the thing it skips is an offer nobody understands.
 *
 * @param segments - The item's marked stretches.
 * @param positionSeconds - Where the viewer is now.
 * @returns The stretch to offer skipping, or null.
 */
const skippableAt = (segments: MediaSegment[], positionSeconds: number): MediaSegment | null =>
  segments.find(
    (segment) =>
      segment.kind !== 'preview' &&
      positionSeconds >= segment.startSeconds &&
      positionSeconds < Math.min(segment.startSeconds + OFFER_SECONDS, segment.endSeconds),
  ) ?? null;

/**
 * Names what skipping would skip, so the button says "skip intro" rather than "skip".
 *
 * @param segment - The stretch being offered.
 * @returns What the button should say.
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

export { fetchSegments, skippableAt, describeSkip };
