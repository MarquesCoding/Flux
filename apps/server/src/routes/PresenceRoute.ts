import { createRoute, z } from '@hono/zod-openapi'

const PresenceError = z.object({ error: z.string() }).openapi('PresenceError')

const PresenceHeartbeatRequest = z
  .object({
    isPlaying: z.boolean(),
    /**
     * What the player itself measured, for an admin looking at this stream
     * to see. Omitted means the caller has nothing to report — a direct
     * play tab that has not attached a media engine yet, for instance.
     */
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
  .openapi('PresenceHeartbeatRequest')

/**
 * Reports whether a tab is actually playing right now.
 *
 * Separate from the transcoder's own session heartbeat (`PlaybackRoute`),
 * which only exists for HLS sessions and keeps the idle reaper off a
 * paused-but-open transcode. This one is presence's own — it fires for
 * direct play too, since that never touches the transcoder at all.
 */
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
})

/**
 * Says a tab has genuinely stopped watching anything.
 *
 * Deliberately separate from stopping a playback session: a quality or
 * track change tears the old session down and starts a new one in the same
 * tab, and that swap must never be mistaken for the viewer leaving — it
 * would flash the admin's card to "not watching" and back for no reason.
 * This is only called once, when the player itself unmounts or the tab
 * actually closes.
 */
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
})

export default { presenceHeartbeatRoute, presenceStopWatchingRoute }
