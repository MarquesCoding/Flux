import { createRoute, z } from '@hono/zod-openapi';

const PresenceError = z.object({ error: z.string() }).openapi('PresenceError');

const PresenceHeartbeatRequest = z
  .object({
    isPlaying: z.boolean(),
    health: z
      .object({
        positionSeconds: z.number().nonnegative(),
        durationSeconds: z.number().nonnegative(),
        bufferedAheadSeconds: z.number().nonnegative(),
        presentedWidth: z.number().int().nonnegative(),
        presentedHeight: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .openapi('PresenceHeartbeatRequest');

const presenceHeartbeatRoute = createRoute({
  method: 'post',
  path: '/api/presence/{clientId}/heartbeat',
  tags: ['Presence'],
  summary: 'Report whether a tab is playing right now',
  request: {
    params: z.object({ clientId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: PresenceHeartbeatRequest } } },
  },
  responses: {
    204: { description: 'The heartbeat was recorded' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: PresenceError } },
    },
  },
});

const presenceStopWatchingRoute = createRoute({
  method: 'delete',
  path: '/api/presence/{clientId}/watching',
  tags: ['Presence'],
  summary: 'Say a tab has stopped watching anything',
  request: {
    params: z.object({ clientId: z.string().min(1) }),
  },
  responses: {
    204: { description: 'Recorded' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: PresenceError } },
    },
  },
});

export { presenceHeartbeatRoute, presenceStopWatchingRoute };
