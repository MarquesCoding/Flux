import { createRoute, z } from '@hono/zod-openapi'

const ProgressError = z.object({ error: z.string() }).openapi('ProgressError')

const ProgressSchema = z
  .object({
    mediaId: z.string().uuid(),
    positionSeconds: z.number().nonnegative(),
    durationSeconds: z.number().positive(),
    isFinished: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .openapi('WatchProgress')

const ProgressListSchema = z.object({ progress: z.array(ProgressSchema) }).openapi('ProgressList')

const ReportSchema = z
  .object({
    positionSeconds: z.number().nonnegative(),
    durationSeconds: z.number().positive(),
    isFinished: z.boolean().default(false),
  })
  .openapi('ProgressReport')

/**
 * Reads where this viewer got to in everything.
 *
 * One request for the whole library rather than one per item: a page of cards
 * showing progress would otherwise open a hundred connections to draw a
 * hundred thin bars.
 */
const listProgressRoute = createRoute({
  method: 'get',
  path: '/api/progress',
  tags: ['Progress'],
  summary: 'Read how far this viewer has got in everything',
  responses: {
    200: {
      description: 'Where this viewer got to',
      content: { 'application/json': { schema: ProgressListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ProgressError } },
    },
  },
})

/**
 * Records where this viewer has got to.
 */
const recordProgressRoute = createRoute({
  method: 'put',
  path: '/api/media/{mediaId}/progress',
  tags: ['Progress'],
  summary: 'Record how far this viewer has got',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ReportSchema } } },
  },
  responses: {
    204: { description: 'Recorded' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ProgressError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: ProgressError } },
    },
  },
})

/**
 * Forgets where this viewer got to, so something starts over.
 */
const forgetProgressRoute = createRoute({
  method: 'delete',
  path: '/api/media/{mediaId}/progress',
  tags: ['Progress'],
  summary: 'Forget how far this viewer had got',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    204: { description: 'Forgotten' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ProgressError } },
    },
  },
})

export { listProgressRoute, recordProgressRoute, forgetProgressRoute }
