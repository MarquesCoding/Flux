import { describe, expect, it, vi } from 'vitest';
import {
  createCatalogueMetadataProvider,
  readYear,
  imageUrl,
} from './createCatalogueMetadataProvider';
import type { Fetcher } from './createCatalogueMetadataProvider';
import type { MediaFacts } from './MetadataProvider';
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 7200,
  bitrateKbps: 12000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
};

const facts = (
  path: string,
  episode?: MediaFacts['episode'],
  knownExternalId?: string | null,
): MediaFacts => ({
  path,
  probe,
  ...(episode === undefined ? {} : { episode }),
  ...(knownExternalId === undefined ? {} : { knownExternalId }),
});

const SEARCH = {
  results: [{ id: 329, title: 'Arrival', release_date: '2016-11-10' }],
};

const DETAIL = {
  id: 329,
  title: 'Arrival',
  tagline: 'Why are they here?',
  overview: 'A linguist is recruited to communicate with visitors.',
  release_date: '2016-11-10',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 7.6,
  genres: [{ name: 'Science Fiction' }, { name: 'Drama' }],
  credits: {
    cast: [
      { name: 'Amy Adams', character: 'Louise Banks', profile_path: '/amy.jpg' },
      { name: 'Jeremy Renner', character: 'Ian Donnelly', profile_path: null },
    ],
  },
};

const respondWith = (bodies: Record<string, JsonValue>, status = 200) => {
  const calls: string[] = [];

  const fetchImpl: Fetcher = (url) => {
    calls.push(url);

    const match = Object.entries(bodies).find(([path]) => url.includes(path));

    if (match === undefined) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    }

    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(match[1]),
    });
  };

  return { fetchImpl, calls };
};

const provider = (
  bodies: Record<string, JsonValue>,
  options: { key?: string | null; status?: number; onProblem?: (reason: string) => void } = {},
) => {
  const { fetchImpl, calls } = respondWith(bodies, options.status ?? 200);

  return {
    calls,
    instance: createCatalogueMetadataProvider({
      readApiKey: () => Promise.resolve(options.key === undefined ? 'a-key' : options.key),
      fetchImpl,
      ...(options.onProblem === undefined ? {} : { onProblem: options.onProblem }),
    }),
  };
};

describe('readYear', () => {
  it('reads the year out of a catalogue date', () => {
    expect(readYear('2016-11-10')).toBe(2016);
  });

  it('reports nothing for a date that is not there', () => {
    expect(readYear(undefined)).toBeNull();
    expect(readYear('')).toBeNull();
  });
});

describe('imageUrl', () => {
  it('asks for a width a poster is actually drawn at', () => {
    expect(imageUrl('https://images.test', '/poster.jpg', 'w500')).toBe(
      'https://images.test/w500/poster.jpg',
    );
  });

  it('reports nothing when there is no image', () => {
    expect(imageUrl('https://images.test', null, 'w500')).toBeNull();
  });
});

describe('createCatalogueMetadataProvider', () => {
  it('says nothing at all when no key is configured', async () => {
    const { instance, calls } = provider({}, { key: null });

    await expect(instance.describe(facts('/media/Arrival (2016).mkv'))).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('describes a film from the catalogue', async () => {
    const { instance } = provider({ '/search/movie': SEARCH, '/movie/329': DETAIL });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(found).toMatchObject({
      title: 'Arrival',
      year: 2016,
      tagline: 'Why are they here?',
      genres: ['Science Fiction', 'Drama'],
      rating: 7.6,
      externalId: '329',
    });
  });

  it('names the cast, with their roles', async () => {
    const { instance } = provider({ '/search/movie': SEARCH, '/movie/329': DETAIL });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(found?.cast?.[0]).toMatchObject({ name: 'Amy Adams', role: 'Louise Banks' });
    expect(found?.cast?.[1]?.imageUrl).toBeNull();
  });

  it('addresses artwork at a size worth downloading', async () => {
    const { instance } = provider({ '/search/movie': SEARCH, '/movie/329': DETAIL });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(found?.posterUrl).toContain('/w500/poster.jpg');
    expect(found?.backdropUrl).toContain('/w1280/backdrop.jpg');
  });

  it('searches by the year in the filename, so remakes do not win', async () => {
    const { instance, calls } = provider({ '/search/movie': SEARCH, '/movie/329': DETAIL });

    await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(calls[0]).toContain('year=2016');
  });

  it('searches for a series rather than a film when the path says episode', async () => {
    const { instance, calls } = provider({
      '/search/tv': { results: [{ id: 5, name: 'Some Show', first_air_date: '2019-01-01' }] },
      '/tv/5': { id: 5, name: 'Some Show', genres: [] },
    });

    await instance.describe(
      facts('/media/Some Show/Season 1/Some.Show.S01E02.mkv', {
        seriesTitle: 'Some Show',
        seasonNumber: 1,
        episodeNumber: 2,
      }),
    );

    expect(calls[0]).toContain('/search/tv');
    expect(calls[0]).toContain('Some+Show');
  });

  it('disambiguates a series search by the year its folder names, same as a film', async () => {
    const { instance, calls } = provider({
      '/search/tv': { results: [{ id: 5, name: 'Ted', first_air_date: '2024-01-01' }] },
      '/tv/5': { id: 5, name: 'Ted', genres: [] },
    });

    await instance.describe(
      facts('/media/Ted (2024)/Season 1/s01e01.mkv', {
        seriesTitle: 'Ted',
        seriesYear: 2024,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    );

    expect(calls[0]).toContain('first_air_date_year=2024');
  });

  it('skips search entirely when the item already has a known catalogue id', async () => {
    const { instance, calls } = provider({ '/movie/329': DETAIL });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv', undefined, '329'));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/movie/329');
    expect(found).toMatchObject({ title: 'Arrival', externalId: '329' });
  });

  it('falls back to search when a known id no longer resolves', async () => {
    const { instance, calls } = provider({ '/search/movie': SEARCH, '/movie/329': DETAIL });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv', undefined, '999999'));

    expect(calls[0]).toContain('/movie/999999');
    expect(calls.some((call) => call.includes('/search/movie'))).toBe(true);
    expect(found).toMatchObject({ title: 'Arrival', externalId: '329' });
  });

  it('reports nothing when the catalogue knows nothing', async () => {
    const { instance } = provider({ '/search/movie': { results: [] } });

    await expect(instance.describe(facts('/media/Nonsense.mkv'))).resolves.toBeNull();
  });

  it('reports nothing rather than failing when the catalogue is down', async () => {
    const onProblem = vi.fn();
    const { instance } = provider({ '/search/movie': SEARCH }, { status: 503, onProblem });

    await expect(instance.describe(facts('/media/Arrival (2016).mkv'))).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('keeps what the search found when the details do not arrive', async () => {
    const { instance } = provider({ '/search/movie': SEARCH });

    await expect(instance.describe(facts('/media/Arrival (2016).mkv'))).resolves.toMatchObject({
      title: 'Arrival',
      year: 2016,
    });
  });

  it('omits what the catalogue does not carry rather than inventing it', async () => {
    const { instance } = provider({
      '/search/movie': SEARCH,
      '/movie/329': { id: 329, title: 'Arrival', genres: [] },
    });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(found).not.toHaveProperty('overview');
    expect(found).not.toHaveProperty('posterUrl');
    expect(found).not.toHaveProperty('cast');
  });

  it("prefers an exact title match over the catalogue's own popularity ranking", async () => {
    const { instance, calls } = provider({
      '/search/tv': {
        results: [
          { id: 999, name: 'Ted Lasso', first_air_date: '2020-08-14' },
          { id: 111, name: 'Ted', first_air_date: '2024-01-01' },
        ],
      },
      '/tv/111': { id: 111, name: 'Ted', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/Ted/Season 1/Ted.S01E01.mkv', {
        seriesTitle: 'Ted',
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    );

    expect(calls.some((call) => call.includes('/tv/111'))).toBe(true);
    expect(calls.some((call) => call.includes('/tv/999'))).toBe(false);
    expect(found?.seriesTitle).toBe('Ted');
  });

  it('falls back to the top result when nothing matches the title exactly', async () => {
    const { instance, calls } = provider({
      '/search/movie': {
        results: [{ id: 42, title: 'Arrival of a Train', release_date: '1896-01-01' }],
      },
      '/movie/42': { id: 42, title: 'Arrival of a Train', genres: [] },
    });

    await instance.describe(facts('/media/Arrival.mkv'));

    expect(calls.some((call) => call.includes('/movie/42'))).toBe(true);
  });

  it('refuses an episode whose title disagrees entirely with what the filename said', async () => {
    const { instance } = provider({
      '/tv/5/season/1/episode/2': { name: 'Biscuits with the Boss' },
      '/search/tv': { results: [{ id: 5, name: 'Ted Lasso', first_air_date: '2020-08-14' }] },
      '/tv/5': { id: 5, name: 'Ted Lasso', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/Ted/Season 1/Ted - S01E02 - Pilot.mkv', {
        seriesTitle: 'Ted',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: 'Pilot',
      }),
    );

    expect(found).toBeNull();
  });

  it('accepts an episode title that only roughly agrees, not just an identical one', async () => {
    const { instance } = provider({
      '/tv/5/season/1/episode/2': { name: 'The Biscuits Special' },
      '/search/tv': { results: [{ id: 5, name: 'Some Show', first_air_date: '2020-08-14' }] },
      '/tv/5': { id: 5, name: 'Some Show', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/Some Show/Season 1/Some.Show.S01E02.Biscuits.mkv', {
        seriesTitle: 'Some Show',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: 'Biscuits',
      }),
    );

    expect(found).not.toBeNull();
    expect(found?.title).toBe('The Biscuits Special');
  });

  it('keeps a translated release, where the title differs because the language does', async () => {
    const { instance } = provider({
      '/tv/5/season/1/episode/2': { name: 'To Affection', still_path: '/still.jpg' },
      '/search/tv': {
        results: [{ id: 5, name: 'A Sign of Affection', first_air_date: '2024-01-06' }],
      },
      '/tv/5': { id: 5, name: 'A Sign of Affection', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/A Sign of Affection - 1x02 - Affetto - 1080p.mkv', {
        seriesTitle: 'A Sign of Affection',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: 'Affetto',
      }),
    );

    expect(found?.title).toBe('To Affection');
    expect(found?.externalId).toBe('5');
    expect(found?.backdropUrl).not.toBeNull();
  });

  it('still refuses a disagreeing episode when the series was only the best guess', async () => {
    const { instance } = provider({
      '/tv/5/season/1/episode/2': { name: 'Biscuits with the Boss' },
      '/search/tv': { results: [{ id: 5, name: 'Ted Lasso', first_air_date: '2020-08-14' }] },
      '/tv/5': { id: 5, name: 'Ted Lasso', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/Ted/Season 1/Ted - S01E02 - Pilot.mkv', {
        seriesTitle: 'Ted',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: 'Pilot',
      }),
    );

    expect(found).toBeNull();
  });

  it('does not refuse a match when the filename named no episode title to check against', async () => {
    const { instance } = provider({
      '/tv/5/season/1/episode/2': { name: 'Whatever This One Is Called' },
      '/search/tv': { results: [{ id: 5, name: 'Some Show', first_air_date: '2020-08-14' }] },
      '/tv/5': { id: 5, name: 'Some Show', genres: [] },
    });

    const found = await instance.describe(
      facts('/media/Some Show/Season 1/Some.Show.S01E02.1080p.WEB-DL.mkv', {
        seriesTitle: 'Some Show',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: null,
      }),
    );

    expect(found).not.toBeNull();
  });

  it('never names more of the cast than anyone reads', async () => {
    const crowded = {
      ...DETAIL,
      credits: {
        cast: Array.from({ length: 40 }, (_, index) => ({
          name: `Actor ${index.toString()}`,
          character: 'Someone',
          profile_path: null,
        })),
      },
    };
    const { instance } = provider({ '/search/movie': SEARCH, '/movie/329': crowded });

    const found = await instance.describe(facts('/media/Arrival (2016).mkv'));

    expect(found?.cast).toHaveLength(12);
  });
});
