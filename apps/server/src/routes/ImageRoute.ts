import { createRoute, z } from '@hono/zod-openapi';

const ImageError = z.object({ error: z.string() }).openapi('ImageError');

const mediaImageRoute = createRoute({
  method: 'get',
  path: '/api/media/{mediaId}/image/{kind}',
  tags: ['Library'],
  summary: 'Read the poster, backdrop or logo for an item',
  request: {
    params: z.object({
      mediaId: z.string().uuid(),
      kind: z.enum(['poster', 'backdrop', 'logo']),
    }),
  },
  responses: {
    200: { description: 'The artwork' },
    404: {
      description: 'No such item, or no artwork for it',
      content: { 'application/json': { schema: ImageError } },
    },
  },
});

export { mediaImageRoute };
