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
    delivery: z.enum(['text', 'burnIn']).default('text'),
    streamIndex: z.number().int().nullable().default(null),
  })
  .openapi('SubtitleTrack');

const SubtitleListSchema = z
  .object({ tracks: z.array(SubtitleTrackSchema) })
  .openapi('SubtitleList');

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
