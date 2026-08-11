import { createRoute, z } from '@hono/zod-openapi'

const HealthResponseSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    version: z.string(),
    transcoderReachable: z.boolean(),
  })
  .openapi('HealthResponse')

/**
 * Liveness and readiness for the container health check.
 *
 * Reports `degraded` when the transcoder child is unreachable, so that a dead
 * transcoder is visible rather than surfacing later as playback that spins
 * forever. See ADR-0006.
 */
const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['System'],
  summary: 'Report server health',
  responses: {
    200: {
      description: 'The server is running',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
  },
})

export { healthRoute, HealthResponseSchema }
