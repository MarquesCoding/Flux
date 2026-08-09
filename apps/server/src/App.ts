import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import negotiatePlaybackModule from '@FluxCore/functions/negotiatePlayback'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'
import type { FluxAuth } from '@FluxServer/auth/Auth'
import HealthRouteModule from './routes/HealthRoute'
import PlaybackExplainRouteModule from './routes/PlaybackExplainRoute'

const { negotiatePlayback } = negotiatePlaybackModule
const { describePlaybackMode } = describePlaybackModeModule
const { healthRoute } = HealthRouteModule
const { playbackExplainRoute } = PlaybackExplainRouteModule

const SERVER_VERSION = '0.0.0'

type CreateAppOptions = {
  auth: FluxAuth
}

/**
 * Builds the Flux HTTP application.
 *
 * Every Flux route is registered through its OpenAPI definition, so the
 * published specification cannot drift from the implementation. See ADR-0002.
 *
 * The `/api/auth/*` prefix is delegated wholesale to better-auth, which owns
 * its own routing and documents itself through its `openAPI` plugin. It is the
 * one part of the surface Flux does not define route by route.
 */
const createApp = ({ auth }: CreateAppOptions) => {
  const app = new OpenAPIHono()

  app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw))

  app.openapi(healthRoute, (context) =>
    context.json({ status: 'ok', version: SERVER_VERSION, transcoderReachable: false }, 200),
  )

  app.openapi(playbackExplainRoute, (context) => {
    const { deviceProfile } = context.req.valid('json')

    const media = {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      title: 'Sample Film',
      container: 'mkv',
      durationSeconds: 7200,
      videoCodec: 'hevc',
      videoRange: 'HDR10',
      width: 3840,
      height: 2160,
      bitrateKbps: 24000,
      audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isAtmos: true }],
      subtitleStreams: [],
    } satisfies Parameters<typeof negotiatePlayback>[0]

    const plan = negotiatePlayback(media, deviceProfile)

    return context.json({ mode: describePlaybackMode(plan), plan }, 200)
  })

  app.doc('/api/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Flux API',
      version: SERVER_VERSION,
      description: 'Self-hosted streaming platform API.',
    },
  })

  app.get(
    '/api/reference',
    apiReference({ spec: { url: '/api/openapi.json' }, pageTitle: 'Flux API' }),
  )

  return app
}

export type { CreateAppOptions }

export default { createApp, SERVER_VERSION }
