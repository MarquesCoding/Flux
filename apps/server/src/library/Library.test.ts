import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signedInApp } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from './createMemoryLibraryService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { MediaSummarySchema } from '@FluxContracts/schemas/Library';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const detail = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: MEDIA_ID,
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 8,
  canCopySegments: true,
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: true }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
  ...overrides,
});

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
      hasLogo: false,
      seriesTitle: 'A Sign of Affection',
      seasonNumber,
      episodeNumber,
    },
  });

const build = (media: MediaDetail[] = []) => {
  const { auth, settings, store } = createMemoryAuth();
  const library = createMemoryLibraryService({
    libraries: [
      {
        id: LIBRARY_ID,
        name: 'Films',
        kind: 'movies',
        path: '/media/films',
        itemCount: media.length,
        lastScannedAt: null,
        defaultAudioLanguage: null,
        filesAtOnce: null,
      },
    ],
    media,
  });

  const permissions = createMemoryPermissionService();

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library,
    subtitles: createMemorySubtitleService(),
    segments: createMemorySegmentService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    playback: createMemoryPlaybackService(),
  });

  return { app: signedInApp(app, { store, permissions, isAdministrator: true }), library };
};

describe('library routes', () => {
  it('lists libraries with their item counts', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject([{ name: 'Films', kind: 'movies', itemCount: 1 }]);
  });

  it("changes a library's forced default audio language", async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: 'de' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: LIBRARY_ID, defaultAudioLanguage: 'de' });
  });

  it("changes how many of a library's files are rendered at once", async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: null, filesAtOnce: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: LIBRARY_ID, filesAtOnce: 1 });
  });

  it('leaves the number of files at once alone when a change does not mention it', async () => {
    const { app } = build([detail()]);

    await app.request(`${BASE}/api/libraries/${LIBRARY_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: null, filesAtOnce: 2 }),
    });

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: 'de' }),
    });
    const body = await response.json();

    expect(body).toMatchObject({ defaultAudioLanguage: 'de', filesAtOnce: 2 });
  });

  it('refuses a number of files at once that is not one', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: null, filesAtOnce: 0 }),
    });

    expect(response.status).toBe(400);
  });

  it('answers 404 when changing settings for a library that does not exist', async () => {
    const { app } = build([]);

    const response = await app.request(`${BASE}/api/libraries/${crypto.randomUUID()}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ defaultAudioLanguage: 'de' }),
    });

    expect(response.status).toBe(404);
  });

  it('queues preview regeneration rather than a full rescan', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/regenerate-previews`, {
      method: 'POST',
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ state: 'queued' });
  });

  it('answers 404 when regenerating previews for a library that does not exist', async () => {
    const { app } = build([]);

    const response = await app.request(
      `${BASE}/api/libraries/${crypto.randomUUID()}/regenerate-previews`,
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
  });

  it('lists the items in a library', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 1, items: [{ title: 'Arrival', year: 2016 }] });
  });

  it('returns summaries rather than stream detail in the list', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items`);
    const body = z
      .object({ items: z.array(z.record(z.string(), JsonValueSchema)) })
      .parse(await response.json());

    expect(body.items[0]).not.toHaveProperty('audioStreams');
    expect(MediaSummarySchema.safeParse(body.items[0]).success).toBe(true);
  });

  it('answers with particular items when they are named outright', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ]);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?ids=11111111-1111-4111-8111-111111111111`,
    );

    expect(await response.json()).toMatchObject({ items: [{ title: 'Dune' }] });
  });

  it('answers with nothing where the list of names is empty', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?ids=`);

    expect(await response.json()).toMatchObject({ items: [] });
  });

  it('answers newest first when asked to', async () => {
    const { app } = build([
      detail({ title: 'Older', addedAt: '2020-01-01T00:00:00.000Z' }),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Newer',
        addedAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?order=newest`);
    const body = z
      .object({ items: z.array(z.object({ title: z.string() })) })
      .parse(await response.json());

    expect(body.items.map((item) => item.title)).toEqual(['Newer', 'Older']);
  });

  it('lists the series in a library, saying each one once', async () => {
    const { app } = build([
      episodeOf({ episodeNumber: 1 }),
      episodeOf({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'To Affection',
        episodeNumber: 2,
      }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows`);
    const body = z
      .object({
        shows: z.array(z.object({ id: z.string(), title: z.string(), episodeCount: z.number() })),
      })
      .parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.shows).toMatchObject([
      { id: 'a-sign-of-affection', title: 'A Sign of Affection', episodeCount: 2 },
    ]);
  });

  it('does not call a film a series', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows`);

    expect(await response.json()).toMatchObject({ shows: [] });
  });

  it('reads one series, season by season', async () => {
    const { app } = build([
      episodeOf({ seasonNumber: 1, episodeNumber: 1 }),
      episodeOf({
        id: '11111111-1111-4111-8111-111111111111',
        seasonNumber: 2,
        episodeNumber: 1,
      }),
    ]);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/shows/a-sign-of-affection`,
    );
    const body = z
      .object({
        title: z.string(),
        seasonCount: z.number(),
        seasons: z.array(z.object({ seasonNumber: z.number().nullable() })),
      })
      .parse(await response.json());

    expect(body.title).toBe('A Sign of Affection');
    expect(body.seasonCount).toBe(2);
    expect(body.seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
  });

  it('says so when there is no such series', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/shows/nothing-here`);

    expect(response.status).toBe(404);
  });

  it('says so when there is no such library', async () => {
    const { app } = build([detail()]);

    const response = await app.request(
      `${BASE}/api/libraries/11111111-2222-4333-8444-555555555555/shows`,
    );

    expect(response.status).toBe(404);
  });

  it('searches by title', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?search=dun`);
    const body = await response.json();

    expect(body).toMatchObject({ total: 1, items: [{ title: 'Dune' }] });
  });

  it('finds a film by somebody in it', async () => {
    const { app } = build([
      detail(),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Man on Fire',
        metadata: {
          hasPoster: false,
          hasBackdrop: false,
          hasLogo: false,
          cast: [{ name: 'Denzel Washington', role: 'Creasy', imageUrl: null }],
        },
      }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?search=denzel`);

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Man on Fire' }] });
  });

  it('finds a programme’s episodes by the name of the programme', async () => {
    const { app } = build([
      detail(),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Pilot',
        metadata: {
          hasPoster: false,
          hasBackdrop: false,
          hasLogo: false,
          seriesTitle: 'Ted Lasso',
        },
      }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?search=lasso`);

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Pilot' }] });
  });

  it('lists the genres anything is filed under', async () => {
    const { app } = build([
      detail({
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, genres: ['Sci-Fi'] },
      }),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        metadata: {
          hasPoster: false,
          hasBackdrop: false,
          hasLogo: false,
          genres: ['Drama', 'Sci-Fi'],
        },
      }),
    ]);

    const response = await app.request(`${BASE}/api/library-facets`);

    expect(await response.json()).toMatchObject({ genres: ['Drama', 'Sci-Fi'] });
  });

  it('says what else there is to narrow by, from what is actually held', async () => {
    const { app } = build([
      detail({
        year: 1999,
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, rating: 8.2 },
      }),
      detail({ id: '11111111-1111-4111-8111-111111111111', year: 2016 }),
    ]);

    const response = await app.request(`${BASE}/api/library-facets`);

    expect(await response.json()).toStrictEqual({
      genres: [],
      decades: [2010, 1990],
      maxRating: 8.2,
    });
  });

  it('keeps only what was made in the years asked for', async () => {
    const { app } = build([
      detail({ year: 1994 }),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune', year: 2021 }),
    ]);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?yearFrom=1990&yearTo=1999`,
    );

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Arrival' }] });
  });

  it('leaves out what nobody has rated when a rating floor is asked for', async () => {
    const { app } = build([
      detail({
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, rating: 8.2 },
      }),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?minRating=8`);

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Arrival' }] });
  });

  it('searches what a thing is about, not only what it is called', async () => {
    const { app } = build([
      detail({
        metadata: {
          hasPoster: false,
          hasBackdrop: false,
          hasLogo: false,
          overview: 'A linguist is asked to speak to the visitors.',
        },
      }),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?search=linguist`);

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Arrival' }] });
  });

  it('combines what was asked rather than answering the last of it', async () => {
    const { app } = build([
      detail({
        year: 1994,
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, rating: 6 },
      }),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Dune',
        year: 1994,
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, rating: 8.4 },
      }),
    ]);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?yearFrom=1990&yearTo=1999&minRating=8`,
    );

    expect(await response.json()).toMatchObject({ total: 1, items: [{ title: 'Dune' }] });
  });

  it('pages through items', async () => {
    const { app } = build([
      detail(),
      detail({ id: '11111111-1111-4111-8111-111111111111', title: 'Dune' }),
    ]);

    const response = await app.request(
      `${BASE}/api/libraries/${LIBRARY_ID}/items?limit=1&offset=1`,
    );
    const body = await response.json();

    expect(body).toMatchObject({ total: 2, items: [{ title: 'Dune' }] });
  });

  it('rejects an oversized page request', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?limit=5000`);

    expect(response.status).toBe(400);
  });

  it('reports an unknown library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/items`,
    );

    expect(response.status).toBe(404);
  });

  it('reads one item in full', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      title: 'Arrival',
      audioStreams: [{ codec: 'truehd', isAtmos: true }],
    });
  });

  it('reports an unknown item', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/media/00000000-0000-4000-8000-000000000000`);

    expect(response.status).toBe(404);
  });

  it('queues a scan rather than making the caller wait for it', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, {
      method: 'POST',
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ state: 'queued' });
  });

  it('queues an ordinary scan when force is not asked for', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, {
      method: 'POST',
    });

    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}` });
  });

  it('queues a forced scan when asked to reprobe everything', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=true`, {
      method: 'POST',
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}-force` });
  });

  it('treats force=false as an ordinary scan', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=false`, {
      method: 'POST',
    });

    expect(await response.json()).toMatchObject({ jobId: `job-${LIBRARY_ID}` });
  });

  it('refuses a force value that is neither true nor false', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan?force=yes`, {
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });

  it('reports how a queued scan is getting on', async () => {
    const { app } = build();

    const queued = z
      .object({ jobId: z.string(), state: z.string() })
      .parse(
        await (
          await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/scan`, { method: 'POST' })
        ).json(),
      );

    const response = await app.request(`${BASE}/api/libraries/scans/${queued.jobId}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: 'completed' });
  });

  it('reports scanning an unknown library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/scan`,
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
  });

  it('clears a library and queues a scan to repopulate it', async () => {
    const { app, library } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/reset`, {
      method: 'POST',
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ state: 'queued' });

    const items = await library.listItems(LIBRARY_ID, { limit: 60, offset: 0 });
    expect(items?.items).toHaveLength(0);
  });

  it('reports resetting an unknown library', async () => {
    const { app } = build();

    const response = await app.request(
      `${BASE}/api/libraries/00000000-0000-4000-8000-000000000000/reset`,
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
  });

  it('adds a library', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Shows', kind: 'shows', path: '/media/shows' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'Shows', kind: 'shows' });
  });

  it('rejects an unknown library kind', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Books', kind: 'books', path: '/media/books' }),
    });

    expect(response.status).toBe(400);
  });

  it('documents the library endpoints in the specification', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/openapi.json`);
    const body = await response.json();

    expect(body).toHaveProperty(['paths', '/api/libraries', 'get']);
    expect(body).toHaveProperty(['paths', '/api/media/{id}', 'get']);
  });

  it('serves artwork from Flux rather than sending the browser to a catalogue', async () => {
    const { auth, settings, store } = createMemoryAuth();
    const app = signedInApp(
      createApp({
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
              defaultAudioLanguage: null,
              filesAtOnce: null,
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
      }),
      { store },
    );

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/poster`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('serves the lettering a title is written in, the same way as its poster', async () => {
    const { auth, settings, store } = createMemoryAuth();
    const app = signedInApp(
      createApp({
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
              path: '/media/films',
              itemCount: 1,
              lastScannedAt: null,
              defaultAudioLanguage: null,
              filesAtOnce: null,
            },
          ],
          media: [detail()],
        }),
        playback: createMemoryPlaybackService(),
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        readImage: () => Promise.resolve({ body: new ArrayBuffer(8), contentType: 'image/png' }),
      }),
      { store },
    );

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/logo`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('reports no artwork rather than serving a blank image', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/poster`);

    expect(response.status).toBe(404);
  });

  it('refuses to serve artwork of a kind it does not have', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/image/something-else`);

    expect(response.status).toBe(400);
  });
});

describe('rebuilding one item’s artefacts', () => {
  it('throws away the preview and the thumbnails', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/artefacts/rebuild`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ preview: true, trickplay: true });
  });

  it('answers 404 for an item that does not exist', async () => {
    const { app } = build([detail()]);

    const response = await app.request(
      `${BASE}/api/media/${crypto.randomUUID()}/artefacts/rebuild`,
      { method: 'POST' },
    );

    expect(response.status).toBe(404);
  });
});

describe('narrowing a library down', () => {
  it('offers only what belongs to a series when shows are asked for', async () => {
    const { app } = build([detail(), episodeOf()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?kind=shows`);
    const body = z.object({ items: z.array(MediaSummarySchema) }).parse(await response.json());

    expect(body.items.map((one) => one.title)).toEqual(['Yuki’s World']);
  });

  it('offers only what stands on its own when films are asked for', async () => {
    const { app } = build([detail(), episodeOf()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?kind=films`);
    const body = z.object({ items: z.array(MediaSummarySchema) }).parse(await response.json());

    expect(body.items.map((one) => one.title)).toEqual(['Arrival']);
  });

  it('offers only what carries the genre asked for', async () => {
    const { app } = build([
      detail({
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, genres: ['Drama'] },
      }),
      detail({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Heat',
        metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, genres: ['Crime'] },
      }),
    ]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?genre=Crime`);
    const body = z.object({ items: z.array(MediaSummarySchema) }).parse(await response.json());

    expect(body.items.map((one) => one.title)).toEqual(['Heat']);
  });

  it('offers nothing for a genre nothing carries', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items?genre=Western`);
    const body = z.object({ items: z.array(MediaSummarySchema) }).parse(await response.json());

    expect(body.items).toEqual([]);
  });
});

describe('saying what something actually is', () => {
  it('takes a catalogue id and says how many files it reached', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: '329', kind: 'movie' }),
    });

    expect(response.status).toBe(200);
  });

  it('reads the kind out of a catalogue address, so pasting a link is enough', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: 'https://www.themoviedb.org/movie/329-arrival' }),
    });

    expect(response.status).toBe(200);
  });

  it('refuses something that is not a catalogue reference at all', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: 'the one with the aliens' }),
    });

    expect(response.status).toBe(400);
  });

  it('asks which kind a bare number is, since the same number is both', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: '329' }),
    });

    expect(response.status).toBe(400);
  });

  it('has nothing to correct about an item that is not there', async () => {
    const { app } = build([]);

    const response = await app.request(
      `${BASE}/api/media/11111111-1111-4111-8111-111111111111/match`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference: '329', kind: 'movie' }),
      },
    );

    expect(response.status).toBe(404);
  });

  it('forgets a correction, so the next scan reads the file as it finds it', async () => {
    const { app } = build([detail()]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
  });

  it('has nothing to forget about an item that is not there', async () => {
    const { app } = build([]);

    const response = await app.request(
      `${BASE}/api/media/11111111-1111-4111-8111-111111111111/match`,
      { method: 'DELETE' },
    );

    expect(response.status).toBe(404);
  });
});

describe('asking for work against a library that is not there', () => {
  const MISSING = '22222222-2222-4222-8222-222222222222';

  const asks: [string, string][] = [
    ['POST', `/api/libraries/${MISSING}/reset`],
    ['POST', `/api/libraries/${MISSING}/regenerate-previews`],
  ];

  for (const [method, path] of asks) {
    it(`answers ${method} ${path} with nothing to work on`, async () => {
      const { app } = build([detail()]);

      const response = await app.request(`${BASE}${path}`, { method });

      expect(response.status).toBe(404);
    });
  }

  it('reaches every episode of a series when one of them is corrected', async () => {
    const { app } = build([
      episodeOf({ id: MEDIA_ID }),
      episodeOf({ id: '33333333-3333-4333-8333-333333333333', episodeNumber: 2 }),
    ]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: '5', kind: 'tv' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ corrected: 2 });
  });

  it('reaches only the film itself when a film is corrected', async () => {
    const { app } = build([detail(), detail({ id: '33333333-3333-4333-8333-333333333333' })]);

    const response = await app.request(`${BASE}/api/media/${MEDIA_ID}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: '329', kind: 'movie' }),
    });

    expect(await response.json()).toMatchObject({ corrected: 1 });
  });
});

describe('adding a library', () => {
  it('refuses a path that is not a readable directory', async () => {
    const { auth, settings, store } = createMemoryAuth();
    const permissions = createMemoryPermissionService();
    const library = createMemoryLibraryService();

    const app = signedInApp(
      createApp({
        auth,
        settings,
        permissions,
        countUsers: () => Promise.resolve(1),
        promoteToAdmin: () => Promise.resolve(),
        library: { ...library, create: () => Promise.resolve(null) },
        subtitles: createMemorySubtitleService(),
        segments: createMemorySegmentService(),
        progress: createMemoryWatchProgressService(),
        favourites: createMemoryFavouriteService(),
        playback: createMemoryPlaybackService(),
      }),
      { store, permissions, isAdministrator: true },
    );

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Films', kind: 'movies', path: '/nowhere' }),
    });

    expect(response.status).toBe(400);
  });

  it('adds one for a path that is there', async () => {
    const { app } = build([]);

    const response = await app.request(`${BASE}/api/libraries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Shows', kind: 'shows', path: '/media/shows' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'Shows', filesAtOnce: null });
  });

  it('reports an item with no year rather than leaving the field out', async () => {
    const { app } = build([detail({ year: null })]);

    const response = await app.request(`${BASE}/api/libraries/${LIBRARY_ID}/items`);
    const body = z.object({ items: z.array(MediaSummarySchema) }).parse(await response.json());

    expect(body.items[0]?.year).toBeNull();
  });
});
