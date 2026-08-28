import { createRoute, z } from '@hono/zod-openapi';
import { PlaybackPlanSchema } from '@ValenceContracts/schemas/PlaybackPlan';
import { DeviceProfileSchema } from '@ValenceContracts/schemas/DeviceProfile';
import { QualityStepIdSchema } from '@ValenceContracts/schemas/QualityStep';
import { TranscodeReuseSchema } from '@ValenceContracts/schemas/TranscodeReuse';
import { PLAYBACK_MODES } from '@ValenceContracts/functions/describePlaybackMode';
const PlaybackError = z.object({ error: z.string() }).openapi('PlaybackError');

const ExplainResponse = z
  .object({ mode: z.enum(PLAYBACK_MODES), plan: PlaybackPlanSchema })
  .openapi('PlaybackExplainResponse');

const StartRequest = z
  .object({
    deviceProfile: DeviceProfileSchema,
    clientId: z.string().min(1).optional(),
    startSeconds: z.number().int().nonnegative().optional(),
    audioStreamIndex: z.number().int().nonnegative().optional(),
    requestedQuality: QualityStepIdSchema.optional(),
  })
  .openapi('PlaybackStartRequest');

const DeliverySchema = z
  .union([
    z.object({ kind: z.literal('hls'), manifestUrl: z.string() }),
    z.object({ kind: z.literal('direct'), url: z.string() }),
  ])
  .openapi('PlaybackDelivery');

const StartResponse = z
  .object({
    sessionId: z.string(),
    delivery: DeliverySchema,
    mode: z.enum(PLAYBACK_MODES),
    plan: PlaybackPlanSchema,
    warnings: z.array(z.string()),
    reuse: TranscodeReuseSchema.nullable(),
  })
  .openapi('PlaybackStartResponse');

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
});

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
});

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
});

const stopRoute = createRoute({
  method: 'delete',
  path: '/api/playback/session/{sessionId}',
  tags: ['Playback'],
  summary: 'Stop a playback session',
  request: {
    params: z.object({ sessionId: z.string().min(1) }),
    query: z.object({ clientId: z.string().min(1).optional() }),
  },
  responses: {
    204: { description: 'The session was stopped' },
    404: {
      description: 'No such session',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
});

const HeartbeatRequest = z
  .object({
    isPlaying: z.boolean(),
  })
  .openapi('PlaybackHeartbeatRequest');

const heartbeatRoute = createRoute({
  method: 'post',
  path: '/api/playback/session/{sessionId}/heartbeat',
  tags: ['Playback'],
  summary: 'Report that a session is still wanted, and whether it is playing',
  request: {
    params: z.object({ sessionId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: HeartbeatRequest } } },
  },
  responses: {
    204: { description: 'The heartbeat was recorded' },
    404: {
      description: 'No such session',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
});

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
});

const TrickplayResponse = z
  .object({
    id: z.string(),
    url: z.string(),
    intervalSeconds: z.number(),
    tileWidth: z.number(),
    tileHeight: z.number(),
  })
  .openapi('TrickplayResponse');

const trickplayRoute = createRoute({
  method: 'post',
  path: '/api/playback/{mediaId}/trickplay',
  tags: ['Playback'],
  summary: 'Render seek-bar preview thumbnails',
  request: { params: z.object({ mediaId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Where to find the thumbnails',
      content: { 'application/json': { schema: TrickplayResponse } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: PlaybackError } },
    },
    500: {
      description: 'The thumbnails could not be rendered',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
});

const frameRoute = createRoute({
  method: 'get',
  path: '/api/playback/{mediaId}/frame',
  tags: ['Playback'],
  summary: 'Read a single frame as a picture',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    query: z.object({
      seconds: z.coerce.number().int().nonnegative().default(0),
      width: z.coerce.number().int().positive().max(3840).default(1280),
    }),
  },
  responses: {
    200: { description: 'The frame' },
    404: {
      description: 'No such media item, or no frame there',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
});

const trickplayFileRoute = createRoute({
  method: 'get',
  path: '/api/playback/trickplay/{trickplayId}/{name}',
  tags: ['Playback'],
  summary: 'Read a thumbnail index or sheet',
  request: {
    params: z.object({ trickplayId: z.string().min(1), name: z.string().min(1) }),
  },
  responses: {
    200: { description: 'The index or sheet' },
    404: {
      description: 'No such thumbnails',
      content: { 'application/json': { schema: PlaybackError } },
    },
  },
});

export {
  explainRoute,
  startRoute,
  sessionFileRoute,
  directFileRoute,
  trickplayRoute,
  trickplayFileRoute,
  frameRoute,
  stopRoute,
  heartbeatRoute,
};
