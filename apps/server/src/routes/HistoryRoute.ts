import { createRoute, z } from '@hono/zod-openapi';

const HistoryError = z.object({ error: z.string() }).openapi('HistoryError');

/**
 * One thing somebody watched, once.
 *
 * `secondsWatched` is how long was actually spent, not how long the thing is:
 * a pause is not watching and a skipped intro is not watched.
 */
const Viewing = z
  .object({
    id: z.string(),
    mediaItemId: z.string(),
    startedAt: z.string().datetime(),
    lastWatchedAt: z.string().datetime(),
    secondsWatched: z.number().nonnegative(),
    isFinished: z.boolean(),
  })
  .openapi('Viewing');

/**
 * What this profile has watched, most recent first.
 *
 * This profile's own, always. History is more personal than progress, and an
 * endpoint that would list anybody's is a different feature with a different
 * permission behind it.
 */
const listHistoryRoute = createRoute({
  method: 'get',
  path: '/api/history',
  tags: ['History'],
  summary: 'List what this profile has watched',
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },
  responses: {
    200: {
      description: 'What was watched',
      content: { 'application/json': { schema: z.object({ viewings: z.array(Viewing) }) } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: HistoryError } },
    },
  },
});

/**
 * Forgets one viewing.
 */
const forgetViewingRoute = createRoute({
  method: 'delete',
  path: '/api/history/{id}',
  tags: ['History'],
  summary: 'Forget one thing watched',
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    204: { description: 'It is forgotten' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: HistoryError } },
    },
    404: {
      description: 'No such viewing for this profile',
      content: { 'application/json': { schema: HistoryError } },
    },
  },
});

/**
 * Forgets everything this profile has watched.
 */
const forgetHistoryRoute = createRoute({
  method: 'delete',
  path: '/api/history',
  tags: ['History'],
  summary: 'Forget everything this profile has watched',
  responses: {
    200: {
      description: 'How much was forgotten',
      content: {
        'application/json': { schema: z.object({ forgotten: z.number().int().nonnegative() }) },
      },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: HistoryError } },
    },
  },
});

export { listHistoryRoute, forgetViewingRoute, forgetHistoryRoute };
