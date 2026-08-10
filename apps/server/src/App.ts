import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import suggestTrustedOriginsModule from '@FluxServer/setup/suggestTrustedOrigins'
import type { FluxAuth } from '@FluxServer/auth/Auth'
import type { SettingsStore } from '@FluxServer/settings/ServerSettings'
import LibraryServiceModule from '@FluxServer/library/LibraryService'
import type { LibraryService } from '@FluxServer/library/LibraryService'
import type { PlaybackService } from '@FluxServer/playback/PlaybackService'
import HealthRouteModule from './routes/HealthRoute'
import LibraryRouteModule from './routes/LibraryRoute'
import PlaybackRouteModule from './routes/PlaybackRoute'
import SetupRouteModule from './routes/SetupRoute'

const { suggestTrustedOrigins } = suggestTrustedOriginsModule
const { healthRoute } = HealthRouteModule
const { DEFAULT_LIMIT } = LibraryServiceModule
const {
  listLibrariesRoute,
  createLibraryRoute,
  listItemsRoute,
  getMediaRoute,
  scanLibraryRoute,
  scanStateRoute,
} = LibraryRouteModule
const { explainRoute, startRoute, sessionFileRoute, directFileRoute, stopRoute } =
  PlaybackRouteModule
const { setupStatusRoute, setupCompleteRoute } = SetupRouteModule

const SERVER_VERSION = '0.0.0'

type CreateAppOptions = {
  auth: FluxAuth
  settings: SettingsStore
  countUsers: () => Promise<number>
  promoteToAdmin: (email: string) => Promise<void>
  library: LibraryService
  playback: PlaybackService
  isTranscoderReachable?: () => Promise<boolean>
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
const createApp = ({
  auth,
  settings,
  countUsers,
  promoteToAdmin,
  library,
  playback,
  isTranscoderReachable = () => Promise.resolve(false),
}: CreateAppOptions) => {
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
    const queued = await library.scan(context.req.valid('param').id)

    if (queued === null) {
      return context.json({ error: 'No such library.' }, 404)
    }

    return context.json(queued, 202)
  })

  app.openapi(scanStateRoute, async (context) => {
    const { jobId } = context.req.valid('param')

    return context.json({ jobId, state: await library.readScanState(jobId) }, 200)
  })

  app.openapi(healthRoute, async (context) => {
    const transcoderReachable = await isTranscoderReachable()

    return context.json(
      {
        // Degraded rather than unhealthy: the library and interface still work
        // with the media service down, but nothing will play. A health check
        // that reported "ok" here would turn "playback spins forever" into a
        // mystery. See ADR-0006.
        status: transcoderReachable ? ('ok' as const) : ('degraded' as const),
        version: SERVER_VERSION,
        transcoderReachable,
      },
      200,
    )
  })

  app.openapi(explainRoute, async (context) => {
    const { mediaId } = context.req.valid('param')
    const { deviceProfile } = context.req.valid('json')

    const explanation = await playback.explain(mediaId, deviceProfile)

    if (explanation === null) {
      return context.json({ error: 'No such media item.' }, 404)
    }

    return context.json(explanation, 200)
  })

  app.openapi(startRoute, async (context) => {
    const { mediaId } = context.req.valid('param')
    const { deviceProfile, startSeconds } = context.req.valid('json')

    const outcome = await playback.start(mediaId, deviceProfile, startSeconds ?? 0)

    if (outcome.kind === 'notFound') {
      return context.json({ error: 'No such media item.' }, 404)
    }

    if (outcome.kind === 'unsupported') {
      return context.json({ error: outcome.reason }, 422)
    }

    if (outcome.kind === 'failed') {
      return context.json({ error: outcome.reason }, 500)
    }

    return context.json(outcome.session, 200)
  })

  app.openapi(sessionFileRoute, async (context) => {
    const { sessionId, name } = context.req.valid('param')

    const file = await playback.readSessionFile(sessionId, name)

    if (file === null) {
      return context.json({ error: 'No such session or segment.' }, 404)
    }

    return context.body(file.body, 200, { 'content-type': file.contentType })
  })

  app.openapi(directFileRoute, async (context) => {
    const { mediaId } = context.req.valid('param')
    const range = context.req.header('range') ?? null

    const file = await playback.readDirectFile(mediaId, range)

    if (file === null) {
      return context.json({ error: 'No such media item.' }, 404)
    }

    const headers: Record<string, string> = {
      'content-type': file.contentType,
      'accept-ranges': 'bytes',
    }

    if (file.contentRange !== null) {
      headers['content-range'] = file.contentRange
    }

    return context.body(file.body, file.status === 206 ? 206 : 200, headers)
  })

  app.openapi(stopRoute, async (context) => {
    const stopped = await playback.stop(context.req.valid('param').sessionId)

    if (!stopped) {
      return context.json({ error: 'No such session.' }, 404)
    }

    return context.body(null, 204)
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
