import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment'

/**
 * The marked stretches of media, as the HTTP layer sees them.
 *
 * A port rather than the database directly, so the routes and the player can
 * be tested without one.
 */
type SegmentService = {
  list: (mediaId: string) => Promise<MediaSegment[]>
  replace: (mediaId: string, segments: MediaSegment[]) => Promise<void>
}

export type { SegmentService }

export default {}
