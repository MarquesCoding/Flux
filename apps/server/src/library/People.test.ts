import { describe, expect, it } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { PersonCreditsSchema, PersonSchema } from '@FluxContracts/schemas/Person';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';
const AMY = 1245;
const FILM_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const OTHER_ID = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
const EPISODE_ID = '7b2c1d0e-3f4a-4b5c-8d6e-9f0a1b2c3d4e';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const held = (over: Partial<MediaDetail> = {}, cast: MediaDetail['metadata']['cast'] = []) =>
  ({
    id: FILM_ID,
    libraryId: LIBRARY_ID,
    title: 'Arrival',
    year: 2016,
    container: 'mkv',
    durationSeconds: 7200,
    videoCodec: 'hevc',
    videoRange: 'SDR',
    videoBitDepth: 8,
    canCopySegments: true,
    width: 1920,
    height: 1080,
    bitrateKbps: 8000,
    audioStreams: [],
    subtitleStreams: [],
    addedAt: '2026-08-10T00:00:00.000Z',
    metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false, cast },
    ...over,
  }) satisfies MediaDetail;

const build = (media: MediaDetail[] = []) => {
  const { auth, settings } = createMemoryAuth();

  return createApp({
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
          itemCount: media.length,
          lastScannedAt: null,
          defaultAudioLanguage: null,
          filesAtOnce: null,
        },
      ],
      media,
      people: {
        [AMY]: {
          id: AMY,
          name: 'Amy Adams',
          portraitUrl: '/portrait.jpg',
          biography: 'An actor.',
          bornOn: '1974-08-20',
          bornIn: 'Vicenza, Italy',
        },
      },
    }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
  });
};

/**
 * Somebody signed in, and the cookie that says so.
 */
const signedIn = async (app: ReturnType<typeof build>): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

describe('people over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const app = build();

    expect((await app.request(`${BASE}/api/people/${AMY.toString()}`)).status).toBe(401);
    expect((await app.request(`${BASE}/api/people/${AMY.toString()}/credits`)).status).toBe(401);
  });

  it('says who somebody is', async () => {
    const app = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}`, {
      headers: { cookie, origin: BASE },
    });

    expect(PersonSchema.parse(await response.json()).name).toBe('Amy Adams');
  });

  it('says nothing doing for somebody the catalogue has never heard of', async () => {
    const app = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/999999`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  it('refuses an identifier that is not one', async () => {
    const app = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/nobody`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(400);
  });

  it('finds the films they are in', async () => {
    const app = build([
      held({}, [{ personId: AMY, name: 'Amy Adams', role: 'Louise', imageUrl: null }]),
    ]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    const found = PersonCreditsSchema.parse(await response.json());

    expect(found.films).toHaveLength(1);
    expect(found.films[0]?.title).toBe('Arrival');
  });

  it('finds nothing for somebody this server holds nothing of', async () => {
    const app = build([held({}, [])]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    expect(PersonCreditsSchema.parse(await response.json())).toEqual({
      films: [],
      shows: [],
      episodes: [],
    });
  });

  it('never names an item this server does not hold', async () => {
    const app = build([
      held({ id: FILM_ID }, [{ personId: AMY, name: 'Amy Adams', role: 'Louise', imageUrl: null }]),
      held({ id: OTHER_ID, title: 'Nocturnal Animals' }, [
        { personId: 999, name: 'Somebody Else', role: 'Susan', imageUrl: null },
      ]),
    ]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    const found = PersonCreditsSchema.parse(await response.json());

    expect(found.films.map((film) => film.title)).toEqual(['Arrival']);
  });

  it('does not match somebody by name when the identifier differs', async () => {
    const app = build([
      held({}, [{ personId: 999, name: 'Amy Adams', role: 'Louise', imageUrl: null }]),
    ]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    expect(PersonCreditsSchema.parse(await response.json()).films).toHaveLength(0);
  });

  it('leaves out a cast member scanned before identifiers were kept', async () => {
    const app = build([
      held({}, [{ personId: null, name: 'Amy Adams', role: 'Louise', imageUrl: null }]),
    ]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    expect(PersonCreditsSchema.parse(await response.json()).films).toHaveLength(0);
  });

  it('counts an episode as both an episode and its programme', async () => {
    const app = build([
      held(
        {
          id: EPISODE_ID,
          title: 'System',
          metadata: {
            hasPoster: false,
            hasBackdrop: false,
            hasLogo: false,
            seriesTitle: 'The Bear',
            seasonNumber: 1,
            episodeNumber: 1,
            cast: [{ personId: AMY, name: 'Amy Adams', role: 'Herself', imageUrl: null }],
          },
        },
        [],
      ),
    ]);
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/people/${AMY.toString()}/credits`, {
      headers: { cookie, origin: BASE },
    });

    const found = PersonCreditsSchema.parse(await response.json());

    expect(found.episodes).toHaveLength(1);
    expect(found.shows).toHaveLength(1);
    expect(found.films).toHaveLength(0);
  });
});
