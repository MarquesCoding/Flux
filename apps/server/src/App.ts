import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import negotiatePlaybackModule from '@FluxCore/functions/negotiatePlayback'
import describePlaybackModeModule from '@FluxContracts/functions/describePlaybackMode'
import suggestTrustedOriginsModule from '@FluxServer/setup/suggestTrustedOrigins'
import type { FluxAuth } from '@FluxServer/auth/Auth'
import type { SettingsStore } from '@FluxServer/settings/ServerSettings'
import LibraryServiceModule from '@FluxServer/library/LibraryService'
import type { LibraryService } from '@FluxServer/library/LibraryService'
import HealthRouteModule from './routes/HealthRoute'
import LibraryRouteModule from './routes/LibraryRoute'
import PlaybackExplainRouteModule from './routes/PlaybackExplainRoute'
import SetupRouteModule from './routes/SetupRoute'

const { negotiatePlayback } = negotiatePlaybackModule
const { describePlaybackMode } = describePlaybackModeModule
const { suggestTrustedOrigins } = suggestTrustedOriginsModule
const { healthRoute } = HealthRouteModule
const { DEFAULT_LIMIT } = LibraryServiceModule
const { listLibrariesRoute, createLibraryRoute, listItemsRoute, getMediaRoute, scanLibraryRoute } =
  LibraryRouteModule
const { playbackExplainRoute } = PlaybackExplainRouteModule
const { setupStatusRoute, setupCompleteRoute } = SetupRouteModule

const SERVER_VERSION = '0.0.0'

type CreateAppOptions = {
  auth: FluxAuth
  settings: SettingsStore
  countUsers: () => Promise<number>
  promoteToAdmin: (email: string) => Promise<void>
  library: LibraryService
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
const createApp = ({ auth, settings, countUsers, promoteToAdmin, library }: CreateAppOptions) => {
  const app = new OpenAPIHono()

  app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw))

  app.openapi(setupStatusRoute, async (context) => {
    const detectedOrigin = new URL(context.req.url).origin

    return context.json(
      {
        isComplete: (await countUsers()) > 0,
        detectedOrigin,
        isSecureContext: detectedOrigin.startsWith('https://'),
        suggestedTrustedOrigins: suggestTrustedOrigins(detectedOrigin),
      },
      200,
    )
  })

  app.openapi(setupCompleteRoute, async (context) => {
    if ((await countUsers()) > 0) {
      return context.json({ error: 'Setup has already been completed.' }, 409)
    }

    const { admin, trustedOrigins, cookieSecure } = context.req.valid('json')

    const created = await auth.api.signUpEmail({
      body: { name: admin.name, email: admin.email, password: admin.password },
      asResponse: true,
    })

    if (!created.ok) {
      return context.json({ error: 'The administrator account could not be created.' }, 400)
    }

    await promoteToAdmin(admin.email)

    const previous = await settings.read()

    await settings.write({
      trustedOrigins,
      cookieSecure,
      setupCompletedAt: new Date().toISOString(),
    })

    return context.json(
      { isComplete: true, restartRequired: previous.cookieSecure !== cookieSecure },
      200,
    )
  })

  app.openapi(listLibrariesRoute, async (context) => context.json(await library.list(), 200))

  app.openapi(createLibraryRoute, async (context) => {
    const created = await library.create(context.req.valid('json'))

    if (created === null) {
      return context.json({ error: 'That path is not a readable directory.' }, 400)
    }

    return context.json(created, 201)
  })

  app.openapi(listItemsRoute, async (context) => {
    const { id } = context.req.valid('param')
    const { search, limit, offset } = context.req.valid('query')

    const page = await library.listItems(id, {
      ...(search === undefined ? {} : { search }),
      limit: limit ?? DEFAULT_LIMIT,
      offset: offset ?? 0,
    })

    if (page === null) {
      return context.json({ error: 'No such library.' }, 404)
    }

    return context.json(page, 200)
  })

  app.openapi(getMediaRoute, async (context) => {
    const item = await library.getMedia(context.req.valid('param').id)

    if (item === null) {
      return context.json({ error: 'No such item.' }, 404)
    }

    return context.json(item, 200)
  })

  app.openapi(scanLibraryRoute, async (context) => {
    const result = await library.scan(context.req.valid('param').id)

    if (result === null) {
      return context.json({ error: 'No such library.' }, 404)
    }

    return context.json(result, 200)
  })

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
