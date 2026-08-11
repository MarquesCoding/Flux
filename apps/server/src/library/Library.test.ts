import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { createApp } from '@FluxServer/App'
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth'
import { createMemoryLibraryService } from './createMemoryLibraryService'
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService'
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService'
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService'
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService'
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService'
import { MediaSummarySchema } from '@FluxContracts/schemas/Library'
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue'
import type { MediaDetail } from '@FluxContracts/schemas/Library'

const BASE = 'http://localhost:8420'
const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9'

const detail = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: MEDIA_ID,
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: true }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false },
  ...overrides,
})

/**
 * An episode of a series, which is what an item is when its metadata names
 * one — there is no other kind of show.
 */
const episodeOf = ({
  id = MEDIA_ID,
  title = 'Yuki’s World',
  seasonNumber = 1,
  episodeNumber = 1,
}: { id?: string; title?: string; seasonNumber?: number; episodeNumber?: number } = {}) =>
  detail({
    id,
    title,
    metadata: {
      hasPoster: false,
      hasBackdrop: false,
      seriesTitle: 'A Sign of Affection',
      seasonNumber,
      episodeNumber,
    },
  })

const build = (media: MediaDetail[] = []) => {
  const { auth, settings } = createMemoryAuth()
  const library = createMemoryLibraryService({
    libraries: [
      {
        id: LIBRARY_ID,
        name: 'Films',
        kind: 'movies',
        path: '/media/films',
        itemCount: media.length,
        lastScannedAt: null,
      },
    ],
    media,
  })

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library,
    subtitles: createMemorySubtitleService(),
    segments: createMemorySegmentService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    playback: createMemoryPlaybackService(),
  })

  return { app, library }
}

describe('library routes', () => {
  it('lists libraries with their item counts', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject([{ name: 'Films', kind: 'movies', itemCount: 1 }])
  })

  it('lists the items in a library', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ total: 1, items: [{ title: 'Arrival', year: 2016 }] })
  })

  it('returns summaries rather than stream detail in the list', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items`)
    const body = z
      .object({ items: z.array(z.record(z.string(), JsonValueSchema)) })
      .parse(await response.json())

    expect(body.items[0]).not.toHaveProperty('audioStreams')
    expect(MediaSummarySchema.safeParse(body.items[0]).success).toBe(true)
  })

  it('answers with particular items when they are named outright', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ])

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?ids=11111111-1111-4111-8111-111111111111`,
    )

    expect(await response.json()).toMatchObject({ items: [{ title: 'Dune' }] })
  })

  it('answers with nothing where the list of names is empty', async () => {
    // A page of favourites belonging to somebody who has kept nothing asks
    // this, and the honest answer is nothing rather than everything.
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?ids=`)

    expect(await response.json()).toMatchObject({ items: [] })
  })

  it('answers newest first when asked to', async () => {
    const { app } = build([
      detail({ title: 'Older', addedAt: '2020-01-01T00:00:00.000Z' }),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Newer',
        addedAt: '2026-01-01T00:00:00.000Z',
      }),
    ])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?order=newest`)
    const body = z
      .object({ items: z.array(z.object({ title: z.string() })) })
      .parse(await response.json())

    expect(body.items.map((item) => item.title)).toEqual(['Newer', 'Older'])
  })

  it('lists the series in a library, saying each one once', async () => {
    const { app } = build([
      episodeOf({ episodeNumber: 1 }),
      episodeOf({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'To Affection',
        episodeNumber: 2,
      }),
    ])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows`)
    const body = z
      .object({
        shows: z.array(z.object({ id: z.string(), title: z.string(), episodeCount: z.number() })),
      })
      .parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.shows).toMatchObject([
      { id: 'a-sign-of-affection', title: 'A Sign of Affection', episodeCount: 2 },
    ])
  })

  it('does not call a film a series', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows`)

    expect(await response.json()).toMatchObject({ shows: [] })
  })

  it('reads one series, season by season', async () => {
    const { app } = build([
      episodeOf({ seasonNumber: 1, episodeNumber: 1 }),
      episodeOf({
        id: '11111111-1111-4111-8111-111111111111',
        seasonNumber: 2,
        episodeNumber: 1,
      }),
    ])

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/shows/a-sign-of-affection`,
    )
    const body = z
      .object({
        title: z.string(),
        seasonCount: z.number(),
        seasons: z.array(z.object({ seasonNumber: z.number().nullable() })),
      })
      .parse(await response.json())

    expect(body.title).toBe('A Sign of Affection')
    expect(body.seasonCount).toBe(2)
    expect(body.seasons.map((season) => season.seasonNumber)).toEqual([1, 2])
  })

  it('says so when there is no such series', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows/nothing-here`)

    expect(response.status).toBe(404)
  })

  it('says so when there is no such library', async () => {
    const { app } = build([detail()])

    const response = await app.request(
      `${BASE}/api/libraries/11111111-2222-4333-8444-555555555555/shows`,
    )

    expect(response.status).toBe(404)
  })

  it('searches by title', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?search=dun`)
    const body = await response.json()

    expect(body).toMatchObject({ total: 1, items: [{ title: 'Dune' }] })
  })

  it('pages through items', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?limit=1&offset=1`)
    const body = await response.json()

    expect(body).toMatchObject({ total: 2, items: [{ title: 'Dune' }] })
  })

  it('rejects an oversized page request', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?limit=5000`)

    expect(response.status).toBe(400)
  })

  it('reports an unknown library', async () => {
    const { app } = build()

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/items`,
    )

    expect(response.status).toBe(404)
  })

  it('reads one item in full', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      title: 'Arrival',
      audioStreams: [{ codec: 'truehd', isAtmos: true }],
    })
  })

  it('reports an unknown item', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/media/00000000-0000-4000-8000-000000000000`)

    expect(response.status).toBe(404)
  })

  it('queues a scan rather than making the caller wait for it', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, {
      method: 'POST',
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ state: 'queued' })
  })

  it('queues an ordinary scan when force is not asked for', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, {
      method: 'POST',
    })

    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}` })
  })

  it('queues a forced scan when asked to reprobe everything', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=true`, {
      method: 'POST',
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}-force` })
  })

  it('treats force=false as an ordinary scan', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=false`, {
      method: 'POST',
    })

    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}` })
  })

  it('refuses a force value that is neither true nor false', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=yes`, {
      method: 'POST',
    })

    expect(response.status).toBe(400)
  })

  it('reports how a queued scan is getting on', async () => {
    const { app } = build()

    const queued = z
      .object({ jobId: z.string(), state: z.string() })
      .parse(
        await (
          await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, { method: 'POST' })
        ).json(),
      )

    const response = await app.request(`${BASE}/api/libraries/scans/${queued.jobId}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ state: 'completed' })
  })

  it('reports scanning an unknown library', async () => {
    const { app } = build()

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/scan`,
      { method: 'POST' },
    )

    expect(response.status).toBe(404)
  })

  it('clears a library and queues a scan to repopulate it', async () => {
    const { app, library } = build([detail()])

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/reset`, {
      method: 'POST',
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ state: 'queued' })

    const items = await library.listItems(LIBRARY_ID, { limit: 60, offset: 0 })
    expect(items?.items).toHaveLength(0)
  })

  it('reports resetting an unknown library', async () => {
    const { app } = build()

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/reset`,
      { method: 'POST' },
    )

    expect(response.status).toBe(404)
  })

  it('adds a library', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Shows', kind: 'shows', path: '/media/shows' }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ name: 'Shows', kind: 'shows' })
  })

  it('rejects an unknown library kind', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Books', kind: 'books', path: '/media/books' }),
    })

    expect(response.status).toBe(400)
  })

  it('documents the library endpoints in the specification', async () => {
    const { app } = build()

    const response = await app.request(`${BASE}/api/openapi.json`)
    const body = await response.json()

    expect(body).toHaveProperty(['paths', '/api/libraries', 'get'])
    expect(body).toHaveProperty(['paths', '/api/media/{id}', 'get'])
  })

  it('serves artwork from Flux rather than sending the browser to a catalogue', async () => {
    const { auth, settings } = createMemoryAuth()
    const app = createApp({
      auth,
      settings,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService({
        libraries: [
          {
            id: LIBRARY_ID,
            name: 'Films',
            kind: 'movies',
            path: '/media',
            itemCount: 1,
            lastScannedAt: null,
          },
        ],
        media: [detail()],
      }),
      playback: createMemoryPlaybackService(),
      subtitles: createMemorySubtitleService(),
      segments: createMemorySegmentService(),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      readImage: () => Promise.resolve({ body: new ArrayBuffer(8), contentType: 'image/jpeg' }),
    })

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/poster`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toContain('immutable')
  })

  it('reports no artwork rather than serving a blank image', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/poster`)

    expect(response.status).toBe(404)
  })

  it('refuses to serve artwork of a kind it does not have', async () => {
    const { app } = build([detail()])

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/something-else`)

    expect(response.status).toBe(400)
  })
})
