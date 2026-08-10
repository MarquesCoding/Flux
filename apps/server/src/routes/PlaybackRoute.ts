import { createRoute, z } from '@hono/zod-openapi'
import PlaybackPlanModule from '@FluxContracts/schemas/PlaybackPlan'
import DeviceProfileModule from '@FluxContracts/schemas/DeviceProfile'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'

const { PlaybackPlanSchema } = PlaybackPlanModule
const { DeviceProfileSchema } = DeviceProfileModule
const { PLAYBACK_MODES } = describePlaybackModeModule

const PlaybackError = z.object({ error: z.string() }).openapi('PlaybackError')

const ExplainResponse = z
  .object({ mode: z.enum(PLAYBACK_MODES), plan: PlaybackPlanSchema })
  .openapi('PlaybackExplainResponse')

const StartRequest = z
  .object({
    deviceProfile: DeviceProfileSchema,
    startSeconds: z.number().int().nonnegative().optional(),
  })
  .openapi('PlaybackStartRequest')

const DeliverySchema = z
  .union([
    z.object({ kind: z.literal('hls'), manifestUrl: z.string() }),
    z.object({ kind: z.literal('direct'), url: z.string() }),
  ])
  .openapi('PlaybackDelivery')

const StartResponse = z
  .object({
    sessionId: z.string(),
    delivery: DeliverySchema,
    mode: z.enum(PLAYBACK_MODES),
    plan: PlaybackPlanSchema,
    warnings: z.array(z.string()),
  })
  .openapi('PlaybackStartResponse')

/**
 * Explains how an item would be played, without starting anything.
 *
 * The dry run from ADR-0011. It answers "why is this transcoding?" without
 * reading server logs, makes device profiles testable, and lets negotiation be
 * regression tested as pure data.
 */
const explainRoute = createRoute({
  method: 'post',
  path: '/api/playback/{mediaId}/explain',
  tags: ['Playback'],
  summary: 'Explain how an item would be played, without starting a session',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: StartRequest } } },
  },
  responses: {
    200: {
      description: 'The plan negotiation would produce',
      content: { 'application/json': { schema: ExplainResponse } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
})

const startRoute = createRoute({
  method: 'post',
  path: '/api/playback/{mediaId}/session',
  tags: ['Playback'],
  summary: 'Start a playback session',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: StartRequest } } },
  },
  responses: {
    200: {
      description: 'The session, and why it is shaped the way it is',
      content: { 'application/json': { schema: StartResponse } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: PlaybackError } },
    },
    422: {
      description: 'This server cannot produce a stream this client can play',
      content: { 'application/json': { schema: PlaybackError } },
    },
    500: {
      description: 'The media service could not start',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
})

/**
 * Serves a manifest or segment from a session.
 *
 * Segment names in an HLS playlist are relative, so they resolve against this
 * path and no rewriting of the playlist is needed.
 */
const sessionFileRoute = createRoute({
  method: 'get',
  path: '/api/playback/session/{sessionId}/{name}',
  tags: ['Playback'],
  summary: 'Read a manifest or segment from a session',
  request: {
    params: z.object({ sessionId: z.string().min(1), name: z.string().min(1) }),
  },
  responses: {
    200: { description: 'The manifest or segment' },
    404: {
      description: 'No such session or segment',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
})

const stopRoute = createRoute({
  method: 'delete',
  path: '/api/playback/session/{sessionId}',
  tags: ['Playback'],
  summary: 'Stop a playback session',
  request: { params: z.object({ sessionId: z.string().min(1) }) },
  responses: {
    204: { description: 'The session was stopped' },
    404: {
      description: 'No such session',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
})

/**
 * Serves the original file for direct play, honouring byte ranges.
 *
 * Proxied through the server rather than exposed directly, for the same reason
 * segments are: the media service has no authentication and would read any
 * path it is given.
 */
const directFileRoute = createRoute({
  method: 'get',
  path: '/api/playback/{mediaId}/file',
  tags: ['Playback'],
  summary: 'Stream the original file for direct play',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    200: { description: 'The whole file' },
    206: { description: 'The requested byte range' },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
})

export default { explainRoute, startRoute, sessionFileRoute, directFileRoute, stopRoute }
