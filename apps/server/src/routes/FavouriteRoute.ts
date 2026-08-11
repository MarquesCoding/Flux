import { createRoute, z } from '@hono/zod-openapi';

const FavouriteError = z.object({ error: z.string() }).openapi('FavouriteError');

const FavouriteSchema = z
  .object({
    mediaId: z.string().uuid(),
    keptAt: z.string().datetime(),
  })
  .openapi('Favourite');

const FavouriteListSchema = z
  .object({ favourites: z.array(FavouriteSchema) })
  .openapi('FavouriteList');

/**
 * Reads everything this viewer has kept.
 *
 * One request for the whole list rather than one per item, for the same reason
 * progress is read in one: a page of cards each asking whether it is kept is a
 * hundred connections to draw a hundred hearts.
 */
const listFavouritesRoute = createRoute({
  method: 'get',
  path: '/api/favourites',
  tags: ['Favourites'],
  summary: 'Read everything this viewer has kept',
  responses: {
    200: {
      description: 'What this viewer has kept',
      content: { 'application/json': { schema: FavouriteListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: FavouriteError } },
    },
  },
});

/**
 * Keeps something.
 *
 * A put rather than a post: keeping something already kept is the same request
 * with the same answer, and a viewer pressing a heart twice should not be told
 * off for it.
 */
const keepFavouriteRoute = createRoute({
  method: 'put',
  path: '/api/media/{mediaId}/favourite',
  tags: ['Favourites'],
  summary: 'Keep this item',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    204: { description: 'Kept' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: FavouriteError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: FavouriteError } },
    },
  },
});

/**
 * Stops keeping something.
 */
const dropFavouriteRoute = createRoute({
  method: 'delete',
  path: '/api/media/{mediaId}/favourite',
  tags: ['Favourites'],
  summary: 'Stop keeping this item',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    204: { description: 'Dropped' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: FavouriteError } },
    },
  },
});

export { listFavouritesRoute, keepFavouriteRoute, dropFavouriteRoute };
