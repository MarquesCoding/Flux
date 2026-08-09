import { createRoute, z } from '@hono/zod-openapi'
import PlaybackPlanModule from '@FluxContracts/schemas/PlaybackPlan'
import DeviceProfileModule from '@FluxContracts/schemas/DeviceProfile'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'

const { PlaybackPlanSchema } = PlaybackPlanModule
const { DeviceProfileSchema } = DeviceProfileModule
const { PLAYBACK_MODES } = describePlaybackModeModule

const ExplainRequestSchema = z
  .object({
    mediaId: z.string().uuid(),
    deviceProfile: DeviceProfileSchema,
  })
  .openapi('PlaybackExplainRequest')

const ExplainResponseSchema = z
  .object({
    mode: z.enum(PLAYBACK_MODES),
    plan: PlaybackPlanSchema,
  })
  .openapi('PlaybackExplainResponse')

/**
 * Returns the playback plan for a media item and device profile without
 * starting a session.
 *
 * This is the dry-run explainer from ADR-0011. It makes profile authoring
 * testable, answers "why is this transcoding?" without reading server logs,
 * and lets negotiation be regression-tested as pure data.
 */
const playbackExplainRoute = createRoute({
  method: 'post',
  path: '/api/playback/explain',
  tags: ['Playback'],
  summary: 'Explain how an item would be played, without starting a session',
  request: {
    body: {
      content: { 'application/json': { schema: ExplainRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'The plan that negotiation would produce',
      content: { 'application/json': { schema: ExplainResponseSchema } },
    },
    404: {
      description: 'No such media item',
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }).openapi('NotFoundError'),
        },
      },
    },
  },
})

export default { playbackExplainRoute, ExplainRequestSchema, ExplainResponseSchema }
