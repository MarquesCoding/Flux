import { createRoute, z } from '@hono/zod-openapi';

const RatingError = z.object({ error: z.string() }).openapi('RatingError');

const RatingSchema = z
  .object({
    mediaId: z.string().uuid().nullable(),
    seriesId: z.string().uuid().nullable(),
    stars: z.number().int().min(1).max(5),
    ratedAt: z.string().datetime(),
  })
  .openapi('Rating');

const RatingListSchema = z.object({ ratings: z.array(RatingSchema) }).openapi('RatingList');

const SetRatingSchema = z.object({ stars: z.number().int().min(1).max(5) }).openapi('SetRating');

const HouseholdRatingSchema = z
  .object({ average: z.number().nullable(), count: z.number().int().nonnegative() })
  .openapi('HouseholdRating');

const listRatingsRoute = createRoute({
  method: 'get',
  path: '/api/ratings',
  tags: ['Ratings'],
  summary: 'Read everything this viewer has rated',
  responses: {
    200: {
      description: 'What this viewer has rated',
      content: { 'application/json': { schema: RatingListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const rateMediaRoute = createRoute({
  method: 'put',
  path: '/api/media/{mediaId}/rating',
  tags: ['Ratings'],
  summary: 'Rate this item',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: SetRatingSchema } } },
  },
  responses: {
    204: { description: 'Rated' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const clearMediaRatingRoute = createRoute({
  method: 'delete',
  path: '/api/media/{mediaId}/rating',
  tags: ['Ratings'],
  summary: 'Take back this item’s rating',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    204: { description: 'Cleared' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const readMediaHouseholdRatingRoute = createRoute({
  method: 'get',
  path: '/api/media/{mediaId}/rating/household',
  tags: ['Ratings'],
  summary: 'Read what the household gave this item',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'What the household gave it',
      content: { 'application/json': { schema: HouseholdRatingSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const rateSeriesRoute = createRoute({
  method: 'put',
  path: '/api/series/{seriesId}/rating',
  tags: ['Ratings'],
  summary: 'Rate this programme',
  request: {
    params: z.object({ seriesId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: SetRatingSchema } } },
  },
  responses: {
    204: { description: 'Rated' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
    404: {
      description: 'No such programme',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const clearSeriesRatingRoute = createRoute({
  method: 'delete',
  path: '/api/series/{seriesId}/rating',
  tags: ['Ratings'],
  summary: 'Take back this programme’s rating',
  request: { params: z.object({ seriesId: z.string().uuid() }) },
  responses: {
    204: { description: 'Cleared' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

const readSeriesHouseholdRatingRoute = createRoute({
  method: 'get',
  path: '/api/series/{seriesId}/rating/household',
  tags: ['Ratings'],
  summary: 'Read what the household gave this programme',
  request: { params: z.object({ seriesId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'What the household gave it',
      content: { 'application/json': { schema: HouseholdRatingSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: RatingError } },
    },
    404: {
      description: 'No such programme',
      content: { 'application/json': { schema: RatingError } },
    },
  },
});

export {
  listRatingsRoute,
  rateMediaRoute,
  clearMediaRatingRoute,
  readMediaHouseholdRatingRoute,
  rateSeriesRoute,
  clearSeriesRatingRoute,
  readSeriesHouseholdRatingRoute,
};
