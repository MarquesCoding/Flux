import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import AppModule from '@FluxServer/App'
import createMemoryAuthModule from '@FluxServer/auth/createMemoryAuth'
import createMemoryLibraryServiceModule from '@FluxServer/library/createMemoryLibraryService'
import createMemoryPlaybackServiceModule from '@FluxServer/playback/createMemoryPlaybackService'
import createMemoryProfileServiceModule from '@FluxServer/profiles/createMemoryProfileService'
import createMemoryProgressServiceModule from '@FluxServer/progress/createMemoryWatchProgressService'
import createMemoryFavouriteServiceModule from '@FluxServer/favourites/createMemoryFavouriteService'
import createMemorySegmentServiceModule from '@FluxServer/segments/createMemorySegmentService'
import createMemorySubtitleServiceModule from '@FluxServer/subtitles/createMemorySubtitleService'

const { createApp } = AppModule
const { createMemoryAuth } = createMemoryAuthModule
const { createMemoryLibraryService } = createMemoryLibraryServiceModule
const { createMemoryPlaybackService } = createMemoryPlaybackServiceModule
const { createMemoryProfileService } = createMemoryProfileServiceModule
const { createMemoryWatchProgressService } = createMemoryProgressServiceModule
const { createMemoryFavouriteService } = createMemoryFavouriteServiceModule
const { createMemorySegmentService } = createMemorySegmentServiceModule
const { createMemorySubtitleService } = createMemorySubtitleServiceModule

const BASE = 'http://localhost:8420'

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
}

/**
 * The server, with everybody who signs up made an administrator.
 *
 * The first account on a self-hosted instance runs it, which is what makes
 * these routes reachable at all.
 */
const LIBRARY = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Movies',
  kind: 'movies' as const,
  path: '/media/movies',
  itemCount: 0,
  lastScannedAt: null,
  defaultAudioLanguage: null,
}

const build = () => {
  const { auth, settings, store } = createMemoryAuth()

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    listUsers: () =>
      Promise.resolve([
        {
          id: 'usr_1',
          name: 'Marques',
          email: CREDENTIALS.email,
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    library: createMemoryLibraryService({ libraries: [LIBRARY], media: [] }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    profiles: createMemoryProfileService(),
  })

  return { app, settings, store }
}

const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  })

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? ''
}

/**
 * Signs up and promotes that account to admin.
 *
 * `promoteToAdmin` in `build()` is a no-op stub — there is no real database
 * for it to write to — so this reaches into the memory auth store directly,
 * the same way `Main.ts`'s real `promoteToAdmin` reaches into Postgres.
 */
const signedInAsAdmin = async (
  app: ReturnType<typeof build>['app'],
  store: ReturnType<typeof build>['store'],
): Promise<string> => {
  const cookie = await signedIn(app)
  const user = store.user[0]

  if (user !== undefined) {
    user.role = 'admin'
  }

  return cookie
}

describe('administration over HTTP', () => {
  it('tells somebody who is not signed in nothing about the server', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/overview`)

    expect(response.status).toBe(403)
  })

  it('tells an ordinary account nothing either, whatever its interface hides', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/overview`, {
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account change a setting', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    })

    expect(response.status).toBe(403)
  })

  it('leaves the setting alone when it refuses', async () => {
    const { app, settings } = build()
    const cookie = await signedIn(app)

    await app.request(`${BASE}/api/admin/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ catalogueApiKey: 'a-key' }),
    })

    expect((await settings.read()).catalogueApiKey).toBe('')
  })

  it('never hands the catalogue key back to a browser', async () => {
    const { app, settings } = build()

    await settings.write({ catalogueApiKey: 'a-secret' })

    const cookie = await signedIn(app)
    const body = await (
      await app.request(`${BASE}/api/admin/overview`, { headers: { cookie, origin: BASE } })
    ).text()

    expect(body).not.toContain('a-secret')
  })

  it('tells somebody who is not signed in nothing about who is streaming', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/sessions`)

    expect(response.status).toBe(403)
  })

  it('tells an ordinary account nothing about who is streaming either', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/sessions`, {
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('will not let an unauthenticated request stop a session', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/sessions/some-session`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account stop a session', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/sessions/some-session`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('will not let an unauthenticated request pause a stream', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/pause`, {
      method: 'POST',
    })

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account pause a stream', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/pause`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('will not let an unauthenticated request resume a stream', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/resume`, {
      method: 'POST',
    })

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account resume a stream', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/sessions/some-session/resume`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('tells somebody who is not signed in nothing about the jobs it can run', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`)

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account list runnable jobs', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`, {
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('will not let an unauthenticated request start a job', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })

    expect(response.status).toBe(403)
  })

  it('will not run a job kind it does not know', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/not-a-real-kind/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })

    expect(response.status).toBe(404)
  })

  it('will not run a job against a library that does not exist', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: '00000000-0000-0000-0000-000000000000' }),
    })

    expect(response.status).toBe(404)
  })

  it('lists every job an admin can start, with reset and rebuild among them', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/definitions`, {
      headers: { cookie, origin: BASE },
    })
    const body = z
      .object({ definitions: z.array(z.object({ kind: z.string() })) })
      .parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.definitions.map((definition) => definition.kind)).toEqual(
      expect.arrayContaining([
        'library.scan',
        'library.regeneratePreviews',
        'library.regenerateTrickplay',
        'library.detectSegments',
        'library.reset',
        'server.cleanupImageCache',
        'server.cleanupSessions',
        'server.checkCatalogueConnectivity',
      ]),
    )
  })

  it('will not run a library-scoped job when no library was given', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(404)
  })

  it('starts a scan for a library an admin picks', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })
    const body = z.object({ jobId: z.string(), state: z.string() }).parse(await response.json())

    expect(response.status).toBe(202)
    expect(body.state).toBe('queued')
  })

  it('runs reset and rebuild through the same generic route', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.reset/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })

    expect(response.status).toBe(202)
  })

  it('starts thumbnail regeneration for a library an admin picks', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.regenerateTrickplay/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })

    expect(response.status).toBe(202)
  })

  it('starts intro and outro detection for a library an admin picks', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.detectSegments/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ libraryId: LIBRARY.id }),
    })

    expect(response.status).toBe(202)
  })

  it('starts an image cache cleanup with no library at all', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/server.cleanupImageCache/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(202)
  })

  it('starts a session cleanup with no library at all', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/server.cleanupSessions/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(202)
  })

  it('starts a catalogue connectivity check with no library at all', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(
      `${BASE}/api/admin/jobs/server.checkCatalogueConnectivity/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: BASE },
        body: JSON.stringify({}),
      },
    )

    expect(response.status).toBe(202)
  })

  it('tells somebody who is not signed in nothing about job schedules', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`)

    expect(response.status).toBe(403)
  })

  it('will not let an ordinary account list job schedules', async () => {
    const { app } = build()
    const cookie = await signedIn(app)

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    })

    expect(response.status).toBe(403)
  })

  it('lists every job with no triggers until one is added', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    })
    const body = z
      .object({
        schedules: z.array(z.object({ kind: z.string(), triggers: z.array(z.unknown()) })),
      })
      .parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.schedules.length).toBeGreaterThan(0)
    expect(body.schedules.every((entry) => entry.triggers.length === 0)).toBe(true)
  })

  it('will not let an unauthenticated request add a trigger', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trigger: { kind: 'startup' } }),
    })

    expect(response.status).toBe(403)
  })

  it('will not add a trigger to a job kind it does not know', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/not-a-real-kind/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'startup' } }),
    })

    expect(response.status).toBe(404)
  })

  it('rejects a trigger cron could not express', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'everyMinutes', minutes: 90 } }),
    })

    expect(response.status).toBe(400)
  })

  it('adds a trigger and reflects it back from the list', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const added = await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'daily', hour: 3, minute: 0 } }),
    })

    expect(added.status).toBe(201)

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    })
    const body = z
      .object({
        schedules: z.array(
          z.object({
            kind: z.string(),
            triggers: z.array(z.object({ id: z.string(), trigger: z.unknown() })),
          }),
        ),
      })
      .parse(await list.json())

    expect(
      body.schedules.find((entry) => entry.kind === 'library.scan')?.triggers.map((t) => t.trigger),
    ).toEqual([{ kind: 'daily', hour: 3, minute: 0 }])
  })

  it('keeps several triggers on one job rather than replacing the last', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    for (const trigger of [{ kind: 'daily', hour: 3, minute: 0 }, { kind: 'startup' }]) {
      await app.request(`${BASE}/api/admin/jobs/library.scan/triggers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: BASE },
        body: JSON.stringify({ trigger }),
      })
    }

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    })
    const body = z
      .object({
        schedules: z.array(
          z.object({
            kind: z.string(),
            triggers: z.array(
              z.object({ id: z.string(), trigger: z.object({ kind: z.string() }) }),
            ),
          }),
        ),
      })
      .parse(await list.json())

    expect(
      body.schedules
        .find((entry) => entry.kind === 'library.scan')
        ?.triggers.map((t) => t.trigger.kind),
    ).toEqual(['daily', 'startup'])
  })

  it('removes a trigger by its id', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const added = await app.request(`${BASE}/api/admin/jobs/server.cleanupSessions/triggers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: BASE },
      body: JSON.stringify({ trigger: { kind: 'everyHours', hours: 6 } }),
    })
    const { id } = z.object({ id: z.string() }).parse(await added.json())

    const removed = await app.request(
      `${BASE}/api/admin/jobs/server.cleanupSessions/triggers/${id}`,
      { method: 'DELETE', headers: { cookie, origin: BASE } },
    )

    expect(removed.status).toBe(204)

    const list = await app.request(`${BASE}/api/admin/jobs/schedules`, {
      headers: { cookie, origin: BASE },
    })
    const body = z
      .object({
        schedules: z.array(z.object({ kind: z.string(), triggers: z.array(z.unknown()) })),
      })
      .parse(await list.json())

    expect(
      body.schedules.find((entry) => entry.kind === 'server.cleanupSessions')?.triggers,
    ).toEqual([])
  })

  it('reports no such trigger when removing one that was never there', async () => {
    const { app, store } = build()
    const cookie = await signedInAsAdmin(app, store)

    const response = await app.request(
      `${BASE}/api/admin/jobs/library.scan/triggers/never-existed`,
      { method: 'DELETE', headers: { cookie, origin: BASE } },
    )

    expect(response.status).toBe(404)
  })
})
