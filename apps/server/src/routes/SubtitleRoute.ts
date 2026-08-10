import { createRoute, z } from '@hono/zod-openapi'

const SubtitleError = z.object({ error: z.string() }).openapi('SubtitleError')

const SubtitleTrackSchema = z
  .object({
    id: z.string(),
    language: z.string().nullable(),
    label: z.string(),
    format: z.string(),
    isForced: z.boolean(),
    isHearingImpaired: z.boolean(),
  })
  .openapi('SubtitleTrack')

const SubtitleListSchema = z
  .object({ tracks: z.array(SubtitleTrackSchema) })
  .openapi('SubtitleList')

/**
 * Lists the subtitle files sitting beside an item.
 *
 * Only tracks that already exist as text on disk. Flux does not demux
 * subtitles out of a container, and a plugin that downloads them writes files
 * here rather than being read through.
 */
const listSubtitlesRoute = createRoute({
  method: 'get',
  path: '/api/media/{mediaId}/subtitles',
  tags: ['Subtitles'],
  summary: 'List the subtitle tracks available for an item',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'The tracks beside the file',
      content: { 'application/json': { schema: SubtitleListSchema } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: SubtitleError } },
    },
  },
})

/**
 * Serves one track as WebVTT.
 *
 * Converted on the way out whatever it arrived as, because WebVTT is the only
 * subtitle format a browser renders.
 */
const readSubtitleRoute = createRoute({
  method: 'get',
  path: '/api/media/{mediaId}/subtitles/{trackId}',
  tags: ['Subtitles'],
  summary: 'Read one subtitle track as WebVTT',
  request: {
    params: z.object({ mediaId: z.string().uuid(), trackId: z.string().min(1) }),
  },
  responses: {
    200: { description: 'The track' },
    404: {
      description: 'No such track',
      content: { 'application/json': { schema: SubtitleError } },
    },
  },
})

export default { listSubtitlesRoute, readSubtitleRoute }
