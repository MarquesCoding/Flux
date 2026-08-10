import { createRoute, z } from '@hono/zod-openapi'
import MediaSegmentModule from '@FluxContracts/schemas/MediaSegment'

const { SEGMENT_KINDS, SEGMENT_SOURCES } = MediaSegmentModule

const SegmentError = z.object({ error: z.string() }).openapi('SegmentError')

const SegmentSchema = z
  .object({
    kind: z.enum(SEGMENT_KINDS),
    startSeconds: z.number(),
    endSeconds: z.number(),
    source: z.enum(SEGMENT_SOURCES),
  })
  .openapi('MediaSegment')

const SegmentListSchema = z.object({ segments: z.array(SegmentSchema) }).openapi('SegmentList')

/**
 * Lists the marked stretches of an item.
 *
 * Answers with an empty list rather than a 404 for an item nothing has been
 * detected on: having no intro is the normal state of a film, and a player
 * asking about one should not have to treat that as an error.
 */
const listSegmentsRoute = createRoute({
  method: 'get',
  path: '/api/media/{mediaId}/segments',
  tags: ['Playback'],
  summary: 'List the intro, recap and credits ranges known for an item',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'What is known about this item',
      content: { 'application/json': { schema: SegmentListSchema } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: SegmentError } },
    },
  },
})

export default { listSegmentsRoute }
