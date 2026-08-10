import { z } from 'zod'
import MediaSegmentModule from '@FluxContracts/schemas/MediaSegment'
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment'

const { MediaSegmentSchema } = MediaSegmentModule

const SegmentListSchema = z.object({ segments: z.array(MediaSegmentSchema) })

/**
 * How long a skip stays offered after its segment has begun.
 *
 * Offering it for the whole intro means the button is on screen for a minute
 * and a half; offering it only at the very start means anyone who looked away
 * has missed it.
 */
const OFFER_SECONDS = 12

/**
 * Reads what is known about an item's intro, recap and credits.
 *
 * Answers with nothing rather than throwing: a skip button is a convenience,
 * and playback must not depend on it.
 */
const fetchSegments = async (mediaId: string): Promise<MediaSegment[]> => {
  try {
    const response = await fetch(`/api/media/${mediaId}/segments`, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return SegmentListSchema.parse(await response.json()).segments
  } catch {
    return []
  }
}

/**
 * The segment worth offering to skip at this moment, if any.
 *
 * Offered only near the start of a segment. Someone who has chosen to watch an
 * intro should not spend the rest of it being asked whether they meant it, and
 * a button that lingers over the episode itself would skip real content.
 */
const skippableAt = (segments: MediaSegment[], positionSeconds: number): MediaSegment | null =>
  segments.find(
    (segment) =>
      segment.kind !== 'preview' &&
      positionSeconds >= segment.startSeconds &&
      positionSeconds < Math.min(segment.startSeconds + OFFER_SECONDS, segment.endSeconds),
  ) ?? null

/**
 * What the button says.
 */
const describeSkip = (segment: MediaSegment): string => {
  if (segment.kind === 'recap') {
    return 'Skip Recap'
  }

  if (segment.kind === 'credits') {
    return 'Skip Credits'
  }

  return 'Skip Intro'
}

export type { MediaSegment }

export default { fetchSegments, skippableAt, describeSkip, OFFER_SECONDS }
