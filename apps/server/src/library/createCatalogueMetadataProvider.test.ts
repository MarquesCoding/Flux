import { describe, expect, it, vi } from 'vitest';
import {
  createCatalogueMetadataProvider,
  readYear,
  imageUrl,
  normalizeTitle,
  significantWords,
  shareASignificantWord,
  similarity,
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

describe('searching the catalogue by name', () => {
  it('offers what the catalogue found, in the shape a picker draws', async () => {
    const { instance } = provider({
      '/search/movie': {
        results: [
          {
            id: 329,
            title: 'Arrival',
            release_date: '2016-11-10',
            overview: 'A linguist is recruited.',
            poster_path: '/poster.jpg',
          },
        ],
      },
    });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toEqual([
      {
        externalId: '329',
        kind: 'movie',
        title: 'Arrival',
        year: 2016,
        overview: 'A linguist is recruited.',
        posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      },
    ]);
  });

  it('reads a series by the name a series carries, which is not the one a film carries', async () => {
    const { instance } = provider({
      '/search/tv': { results: [{ id: 5, name: 'Ted Lasso', first_air_date: '2020-08-14' }] },
    });

    await expect(instance.search?.('Ted Lasso', 'tv')).resolves.toMatchObject([
      { title: 'Ted Lasso', year: 2020 },
    ]);
  });

  it('falls back to what was searched for when the catalogue names nothing', async () => {
    const { instance } = provider({ '/search/movie': { results: [{ id: 1 }] } });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toMatchObject([
      { title: 'Arrival', year: null, overview: null, posterUrl: null },
    ]);
  });

  it('treats an empty overview as none rather than as an empty description', async () => {
    const { instance } = provider({
      '/search/movie': { results: [{ id: 1, title: 'Arrival', overview: '' }] },
    });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toMatchObject([
      { overview: null },
    ]);
  });

  it('offers nothing without a key, rather than asking without one', async () => {
    const { instance, calls } = provider({ '/search/movie': { results: [] } }, { key: null });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('offers nothing when the key is set to nothing at all', async () => {
    const { instance } = provider({ '/search/movie': { results: [] } }, { key: '' });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toEqual([]);
  });

  it('offers nothing rather than guessing when the catalogue answers with nonsense', async () => {
    const { instance } = provider({ '/search/movie': { unexpected: true } });

    await expect(instance.search?.('Arrival', 'movie')).resolves.toEqual([]);
  });
});

describe('reading the shape of a series', () => {
  const SERIES = {
    id: 5,
    name: 'Ted Lasso',
    seasons: [{ season_number: 1, episode_count: 2 }],
  };

  it('reads every season and the episodes in it', async () => {
    const { instance } = provider({
      '/tv/5/season/1': {
        episodes: [
          { episode_number: 1, name: 'Pilot', still_path: '/still.jpg', overview: 'It begins.' },
          { episode_number: 2, name: 'Biscuits' },
        ],
      },
      '/tv/5': SERIES,
    });

    await expect(instance.describeSeries?.('5')).resolves.toEqual({
      seasons: [
        {
          seasonNumber: 1,
          episodeCount: 2,
          episodes: [
            {
              episodeNumber: 1,
              title: 'Pilot',
              stillUrl: 'https://image.tmdb.org/t/p/w780/still.jpg',
              overview: 'It begins.',
            },
            { episodeNumber: 2, title: 'Biscuits', stillUrl: null, overview: null },
          ],
        },
      ],
    });
  });

  it('names an episode by its number when the catalogue gives it no name', async () => {
    const { instance } = provider({
      '/tv/5/season/1': { episodes: [{ episode_number: 3, name: '' }] },
      '/tv/5': SERIES,
    });

    const shape = await instance.describeSeries?.('5');

    expect(shape?.seasons[0]?.episodes[0]).toMatchObject({ title: 'Episode 3' });
  });

  it('leaves a season empty rather than failing when its episodes cannot be read', async () => {
    const { instance } = provider({ '/tv/5': SERIES });

    const shape = await instance.describeSeries?.('5');

    expect(shape?.seasons[0]?.episodes).toEqual([]);
  });

  it('has no shape to offer for a series the catalogue does not know', async () => {
    const { instance } = provider({});

    await expect(instance.describeSeries?.('5')).resolves.toBeNull();
  });

  it('has no shape to offer without a key', async () => {
    const { instance } = provider({ '/tv/5': SERIES }, { key: null });

    await expect(instance.describeSeries?.('5')).resolves.toBeNull();
  });
});

describe('the two ways a catalogue key can be presented', () => {
  const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmbHV4In0.signature';

  it('sends a v4 token as a bearer header rather than in the address', async () => {
    const headers: (Record<string, string> | undefined)[] = [];

    const instance = createCatalogueMetadataProvider({
      readApiKey: () => Promise.resolve(TOKEN),
      fetchImpl: (_url, sent) => {
        headers.push(sent);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [] }),
        });
      },
    });

    await instance.search?.('Arrival', 'movie');

    expect(headers[0]).toMatchObject({ authorization: `Bearer ${TOKEN}` });
  });

  it('keeps a v4 token out of the address, where it would be logged', async () => {
    const asked: string[] = [];

    const instance = createCatalogueMetadataProvider({
      readApiKey: () => Promise.resolve(TOKEN),
      fetchImpl: (url) => {
        asked.push(url);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [] }),
        });
      },
    });

    await instance.search?.('Arrival', 'movie');

    expect(asked.join(' ')).not.toContain(TOKEN);
  });

  it('sends a v3 key as a query parameter, which is how that one is presented', async () => {
    const { instance, calls } = provider({ '/search/movie': { results: [] } });

    await instance.search?.('Arrival', 'movie');

    expect(calls[0]).toContain('api_key=a-key');
  });
});

describe('matching a series, which the catalogue names differently from a film', () => {
  it('takes the name and the first air date a series carries', async () => {
    const { instance } = provider({
      '/search/tv': {
        results: [{ id: 5, name: 'A Sign of Affection', first_air_date: '2024-01-06' }],
      },
    });

    const found = await instance.describe(
      facts('/shows/a-sign-of-affection-s01e01.mkv', {
        seriesTitle: 'A Sign of Affection',
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    );

    expect(found).toMatchObject({ year: 2024 });
  });

  it('falls back to the first result when none of them match by name', async () => {
    const { instance } = provider({
      '/search/movie': {
        results: [{ id: 1, title: 'Something Else', release_date: '1999-01-01' }],
      },
    });

    const found = await instance.describe(facts('/films/Arrival (2016).mkv'));

    expect(found).toMatchObject({ externalId: '1' });
  });
});

describe('reading the lettering a title is written in', () => {
  const ENGLISH = {
    logos: [
      { file_path: '/en.png', iso_639_1: 'en', width: 1097, vote_average: 0 },
      { file_path: '/small.png', iso_639_1: 'en', width: 600, vote_average: 0 },
    ],
  };

  it('asks the catalogue for what it holds for a film', async () => {
    const { instance, calls } = provider({ '/movie/329/images': ENGLISH });

    const url = await instance.readLogoUrl?.({ externalId: '329', isSeries: false });

    expect(url).toBe('https://image.tmdb.org/t/p/w500/en.png');
    expect(calls[0]).toContain('/movie/329/images');
  });

  it('asks about a programme as a programme', async () => {
    const { instance, calls } = provider({ '/tv/208067/images': ENGLISH });

    await instance.readLogoUrl?.({ externalId: '208067', isSeries: true });

    expect(calls[0]).toContain('/tv/208067/images');
  });

  it('asks for what can be read before asking for everything', async () => {
    const { instance, calls } = provider({ '/movie/329/images': ENGLISH });

    await instance.readLogoUrl?.({ externalId: '329', isSeries: false });

    expect(calls[0]).toContain('include_image_language=en%2Cnull');
    expect(calls).toHaveLength(1);
  });

  it('widens the question when a title has no lettering in the wanted language', async () => {
    const answers = [
      { logos: [] },
      { logos: [{ file_path: '/ja.png', iso_639_1: 'ja', width: 906, vote_average: 3.3 }] },
    ];
    const calls: string[] = [];

    const instance = createCatalogueMetadataProvider({
      readApiKey: () => Promise.resolve('a-key'),
      fetchImpl: (url) => {
        calls.push(url);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(answers[calls.length - 1] ?? { logos: [] }),
        });
      },
    });

    const url = await instance.readLogoUrl?.({ externalId: '208067', isSeries: true });

    expect(url).toBe('https://image.tmdb.org/t/p/w500/ja.png');
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toContain('include_image_language');
  });

  it('answers with nothing when no catalogue key is configured', async () => {
    const { instance, calls } = provider({ '/movie/329/images': ENGLISH }, { key: null });

    expect(await instance.readLogoUrl?.({ externalId: '329', isSeries: false })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('answers with nothing rather than throwing when the catalogue talks nonsense', async () => {
    const { instance } = provider({ '/movie/329/images': { logos: 'not a list' } });

    expect(await instance.readLogoUrl?.({ externalId: '329', isSeries: false })).toBeNull();
  });

  it('answers with nothing when a title genuinely has none', async () => {
    const { instance } = provider({ '/movie/329/images': { logos: [] } });

    expect(await instance.readLogoUrl?.({ externalId: '329', isSeries: false })).toBeNull();
  });
});

describe('choosing between what a catalogue answers with', () => {
  it('takes the closest name rather than the most popular one', async () => {
    const { instance } = provider({
      '/search/movie': {
        results: [
          { id: 1, title: 'Arrival of a Train', release_date: '1896-01-01' },
          { id: 2, title: 'Arrival', release_date: '2016-11-10' },
        ],
      },
      '/movie/2': { id: 2, title: 'Arrival', release_date: '2016-11-10' },
    });

    const found = await instance.describe(facts('/media/Arrival 2016 1080p.mkv'));

    expect(found?.externalId).toBe('2');
  });

  it('finds a programme named the way it was made rather than the way it was sold', async () => {
    const { instance } = provider({
      '/search/tv': {
        results: [
          { id: 1, name: 'Something Else Entirely', first_air_date: '2020-01-01' },
          {
            id: 2,
            name: 'My Love Story with Yamada-kun at Lv999',
            original_name: 'Yamada-kun to Lv999 no Koi wo Suru',
            first_air_date: '2023-04-01',
          },
        ],
      },
      '/tv/2': { id: 2, name: 'My Love Story with Yamada-kun at Lv999' },
    });

    const found = await instance.describe(
      facts('/media/Yamada.mkv', {
        seriesTitle: 'Yamada-kun to Lv999 no Koi wo Suru',
        seriesYear: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: null,
      }),
    );

    expect(found?.externalId).toBe('2');
  });
});

const CORPUS = [
  { script: 'Japanese', title: '君の名は' },
  { script: 'Japanese', title: '千と千尋の神隠し' },
  { script: 'Korean', title: '기생충' },
  { script: 'Chinese', title: '霸王别姬' },
  { script: 'Cyrillic', title: 'Брат' },
  { script: 'Cyrillic', title: 'Иди и смотри' },
  { script: 'Greek', title: 'Ελλάδα' },
  { script: 'Arabic', title: 'الرسالة' },
  { script: 'accented Latin', title: 'Amélie' },
  { script: 'Latin', title: 'Arrival' },
] as const;

describe('normalizeTitle', () => {
  for (const { script, title } of CORPUS) {
    it(`keeps a ${script} title rather than deleting it`, () => {
      expect(normalizeTitle(title)).not.toBe('');
    });
  }

  it('lowercases a script that has cases', () => {
    expect(normalizeTitle('Брат')).toBe('брат');
  });

  it('reads two encodings of one accented title as one title', () => {
    expect(normalizeTitle('Amélie')).toBe(normalizeTitle('Ame\u0301lie'));
  });

  it('reads a full-width title as the ordinary one it stands for', () => {
    expect(normalizeTitle('Ｔｅｄ')).toBe('ted');
  });

  it('still strips the punctuation it was written to strip', () => {
    expect(normalizeTitle("Marvel's Daredevil!")).toBe('marvel s daredevil');
  });
});

describe('telling two titles apart, whatever they are written in', () => {
  it('never reads two different titles as the same one', () => {
    const collisions = CORPUS.flatMap(({ title }, at) =>
      CORPUS.slice(at + 1)
        .filter((other) => normalizeTitle(other.title) === normalizeTitle(title))
        .map((other) => `${title} ~ ${other.title}`),
    );

    expect(collisions).toEqual([]);
  });

  it('never scores two different titles a perfect match', () => {
    const perfect = CORPUS.flatMap(({ title }, at) =>
      CORPUS.slice(at + 1)
        .filter((other) => similarity(title, other.title) === 1)
        .map((other) => `${title} ~ ${other.title}`),
    );

    expect(perfect).toEqual([]);
  });

  it('still scores a title against itself a perfect match', () => {
    for (const { title } of CORPUS) {
      expect(similarity(title, title)).toBe(1);
    }
  });

  it('scores two titles it cannot read at all as nothing alike, not identical', () => {
    expect(similarity('!!!', '???')).toBe(0);
  });

  it('keeps Ted apart from Ted Lasso, which is what the exact test is for', () => {
    expect(normalizeTitle('Ted')).not.toBe(normalizeTitle('Ted Lasso'));
    expect(similarity('Ted', 'Ted Lasso')).toBeLessThan(1);
  });
});

describe('significantWords', () => {
  it('reads a word out of a script that writes with spaces', () => {
    expect(significantWords("Marvel's Daredevil")).toEqual(new Set(['marvel', 'daredevil']));
  });

  it('leaves out a short word, which agrees by accident too often', () => {
    expect(significantWords('War of the Worlds').has('the')).toBe(false);
  });

  it('reads words out of a script that does not write with spaces', () => {
    expect(significantWords('千と千尋の神隠し').size).toBeGreaterThan(0);
  });

  it('counts a two-character word where two characters is a word', () => {
    expect(significantWords('霸王别姬')).toEqual(new Set(['霸王']));
  });
});

describe('shareASignificantWord', () => {
  it('agrees when a release and a catalogue word a title differently', () => {
    expect(shareASignificantWord("Marvel's Daredevil", 'Daredevil')).toBe(true);
  });

  it('disagrees about two unrelated titles', () => {
    expect(shareASignificantWord('Arrival', 'Dune')).toBe(false);
  });

  it('lets a title it cannot read through rather than throwing the match away', () => {
    expect(shareASignificantWord('君の名は', 'Your Name')).toBe(true);
  });

  it('agrees about one Cyrillic title said twice', () => {
    expect(shareASignificantWord('Иди и смотри', 'Иди и смотри')).toBe(true);
  });
});

describe('matching a library that is not named in Latin', () => {
  it('does not hand the first foreign candidate the match as though it were exact', async () => {
    const { instance } = provider({
      '/search/movie': {
        results: [
          { id: 1, title: 'Брат', release_date: '1997-12-12' },
          { id: 2, title: '君の名は', release_date: '2016-08-26' },
        ],
      },
      '/movie/2': { id: 2, title: '君の名は', release_date: '2016-08-26' },
    });

    const found = await instance.describe(facts('/media/君の名は (2016).mkv'));

    expect(found?.externalId).toBe('2');
  });

  it('keeps an episode whose title is not written in Latin', async () => {
    const { instance } = provider({
      '/search/tv': {
        results: [{ id: 5, name: '進撃の巨人', first_air_date: '2013-04-07' }],
      },
      '/tv/5': { id: 5, name: '進撃の巨人' },
      '/tv/5/season/1/episode/1': { id: 50, name: '二千年後の君へ' },
    });

    const found = await instance.describe(
      facts('/media/進撃の巨人/S01E01.mkv', {
        seriesTitle: '進撃の巨人',
        seriesYear: null,
        seriesFolder: '/media/進撃の巨人',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: '二千年後の君へ',
      }),
    );

    expect(found).not.toBeNull();
    expect(found?.externalId).toBe('5');
  });

  it('still throws away an episode that plainly belongs to something else', async () => {
    const { instance } = provider({
      '/search/tv': {
        results: [{ id: 5, name: 'Some Other Programme', first_air_date: '2013-04-07' }],
      },
      '/tv/5': { id: 5, name: 'Some Other Programme' },
      '/tv/5/season/1/episode/1': { id: 50, name: 'Completely Different Episode' },
    });

    const found = await instance.describe(
      facts('/media/Some Show/S01E01.mkv', {
        seriesTitle: 'Some Show',
        seriesYear: null,
        seriesFolder: '/media/Some Show',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Nothing Alike Whatsoever',
      }),
    );

    expect(found).toBeNull();
  });
});
