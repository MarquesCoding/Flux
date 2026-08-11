import { createRoute, z } from '@hono/zod-openapi';

const SubtitleError = z.object({ error: z.string() }).openapi('SubtitleError');

const SubtitleTrackSchema = z
  .object({
    id: z.string(),
    language: z.string().nullable(),
    label: z.string(),
    format: z.string(),
    isForced: z.boolean(),
    isHearingImpaired: z.boolean(),
  })
  .openapi('SubtitleTrack');

const SubtitleListSchema = z
  .object({ tracks: z.array(SubtitleTrackSchema) })
  .openapi('SubtitleList');

/**
 * Lists the subtitle tracks an item has.
 *
 * Text tracks from both places they live: files sitting beside the video, and
 * streams inside the container itself. Which one a track came from is not
 * something a viewer should have to think about, so the list does not say.
 *
 * Picture based tracks are absent by design. They hold images rather than
 * characters, so they are burned into the video instead, which playback
 * negotiation decides.
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
});

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
    query: z.object({
      from: z.coerce.number().nonnegative().default(0),
    }),
  },
  responses: {
    200: { description: 'The track' },
    404: {
      description: 'No such track',
      content: { 'application/json': { schema: SubtitleError } },
    },
  },
});

export { listSubtitlesRoute, readSubtitleRoute };
