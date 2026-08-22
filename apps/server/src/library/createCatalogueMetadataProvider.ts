import { wait } from '@ValenceCore/functions/wait';
import { z } from 'zod';
import { CAST_STORED } from '@ValenceContracts/schemas/Person';
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { readTitleFromPath } from './readTitleFromPath';
import { pickLogo } from './pickLogo';
import type { CastMember, Metadata, MetadataProvider } from './MetadataProvider';

const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Decides which kind of credential an operator pasted, since the catalogue takes both an older key
 * and a newer token and they are sent in different places — one as a query parameter, one as a
 * bearer header.
 *
 * @param key - What the operator configured.
 * @returns Whether it is the newer kind.
 */
const isAccessToken = (key: string): boolean => key.split('.').length === 3 && key.startsWith('ey');

const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const RETRIES = 3;

const BACKOFF_MILLISECONDS = 500;

/**
 * Decides whether asking the catalogue again could produce a different answer. A rate limit or a
 * server fault will pass; a bad key or a film that does not exist will not, and retrying those only
 * makes a scan slower.
 *
 * @param status - What the catalogue answered with.
 * @returns Whether the request is worth repeating.
 */
const isWorthRetrying = (status: number): boolean => status === 429 || status >= 500;

const PersonResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  profile_path: z.string().nullish(),
  biography: z.string().nullish(),
  birthday: z.string().nullish(),
  place_of_birth: z.string().nullish(),
});

const SearchResultSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  vote_average: z.number().optional(),
});

const SearchResponseSchema = z.object({ results: z.array(SearchResultSchema).default([]) });

const LogoSchema = z.object({
  file_path: z.string(),
  iso_639_1: z.string().nullish(),
  width: z.number().default(0),
  vote_average: z.number().default(0),
});

const ImagesResponseSchema = z.object({ logos: z.array(LogoSchema).default([]) });

type SearchResult = z.infer<typeof SearchResultSchema>;

const EpisodeResponseSchema = z.object({
  name: z.string().optional(),
  overview: z.string().optional(),
  still_path: z.string().nullish(),
  vote_average: z.number().optional(),
});

const SeasonResponseSchema = z.object({
  episodes: z
    .array(
      z.object({
        episode_number: z.number().int(),
        name: z.string().optional(),
        overview: z.string().optional(),
        still_path: z.string().nullish(),
      }),
    )
    .default([]),
});

const DetailResponseSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  tagline: z.string().optional(),
  overview: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  vote_average: z.number().optional(),
  genres: z.array(z.object({ name: z.string() })).default([]),
  seasons: z
    .array(
      z.object({
        season_number: z.number().int(),
        episode_count: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  credits: z
    .object({
      cast: z
        .array(
          z.object({
            id: z.number().int().positive().nullish(),
            name: z.string(),
            character: z.string().optional(),
            profile_path: z.string().nullish(),
          }),
        )
        .default([]),
    })
    .optional(),
});

type Fetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

type CreateCatalogueMetadataProviderOptions = {
  readApiKey: () => Promise<string | null>;
  baseUrl?: string;
  imageBaseUrl?: string;
  fetchImpl?: Fetcher;
  onProblem?: (reason: string) => void;
};

/**
 * Reads the year out of a catalogue's release date, which is absent for anything unreleased and an
 * empty string for plenty of entries that are.
 *
 * @param date - The date as the catalogue gave it.
 * @returns The year, or null where there was none to read.
 */
const readYear = (date: string | undefined): number | null => {
  const year = Number(date?.slice(0, 4));

  return Number.isInteger(year) && year > 1870 ? year : null;
};

/**
 * Strips a title to the letters and digits in it, in any script, so that punctuation, spacing and
 * case cannot make two spellings of the same title look different.
 *
 * @param value - The title as written.
 * @returns The title as letters and digits alone.
 */
const normalizeTitle = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const LEAST_MEANINGFUL = 4;
const LEAST_MEANINGFUL_DENSE = 2;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'word' });

/**
 * Picks the words of a title worth comparing, dropping the articles and prepositions that almost
 * every title contains — two films sharing only the word "the" share nothing.
 *
 * @param value - The title as written.
 * @returns The words worth matching on.
 */
const significantWords = (value: string): Set<string> => {
  const words = new Set<string>();

  for (const { segment, isWordLike } of SEGMENTER.segment(normalizeTitle(value))) {
    const least = DENSE_SCRIPT.test(segment) ? LEAST_MEANINGFUL_DENSE : LEAST_MEANINGFUL;

    if (isWordLike === true && segment.length >= least) {
      words.add(segment);
    }
  }

  return words;
};

/**
 * Decides whether two titles share a word that means anything, which is the guard against a high
 * similarity score between short titles that merely look alike.
 *
 * @param left - One title.
 * @param right - The title to compare it against.
 * @returns Whether they share a word worth sharing.
 */
const shareASignificantWord = (left: string, right: string): boolean => {
  const leftWords = significantWords(left);
  const rightWords = significantWords(right);

  if (leftWords.size === 0 || rightWords.size === 0) {
    return true;
  }

  return [...rightWords].some((word) => leftWords.has(word));
};

/**
 * Scores how alike two titles are, from nothing to one, on the letters they have in common once
 * both have been stripped. Used to choose between what a catalogue answered a search with, where the
 * filename is the only thing to judge by.
 *
 * @param left - One title.
 * @param right - The title to compare it against.
 * @returns How alike they are.
 */
const similarity = (left: string, right: string): number => {
  const pairsOf = (value: string): string[] => {
    const clean = normalizeTitle(value).replace(/ /g, '');

    return [...clean].slice(0, -1).map((letter, at) => `${letter}${clean[at + 1] ?? ''}`);
  };

  const leftPairs = pairsOf(left);
  const rightPairs = pairsOf(right);

  if (leftPairs.length === 0 || rightPairs.length === 0) {
    const cleanLeft = normalizeTitle(left);

    return cleanLeft !== '' && cleanLeft === normalizeTitle(right) ? 1 : 0;
  }

  const remaining = [...rightPairs];

  const shared = leftPairs.filter((pair) => {
    const at = remaining.indexOf(pair);

    if (at === -1) {
      return false;
    }

    remaining.splice(at, 1);

    return true;
  }).length;

  return (2 * shared) / (leftPairs.length + rightPairs.length);
};

const YEAR_BONUS = 0.15;

/**
 * Picks the likeliest of the entries a catalogue answered a search with, scoring each on its title
 * and its year and refusing everything below a threshold. A wrong match is worse than no match: it
 * fills a library with confident nonsense, where no match leaves the filename showing.
 *
 * @param candidates - What the catalogue offered.
 * @param wanted - The title read from the file.
 * @param year - The year read from the file, where it had one.
 * @returns The entry to use, or null where none were likely enough.
 */
const pickBestMatch = (
  candidates: readonly SearchResult[],
  wanted: string,
  year: number | null,
): SearchResult | undefined => {
  const scored = candidates
    .map((entry) => {
      const found = readYear(entry.release_date ?? entry.first_air_date);

      const names = [entry.title, entry.name, entry.original_title, entry.original_name].filter(
        (name) => name !== undefined,
      );

      return {
        entry,
        score:
          Math.max(0, ...names.map((name) => similarity(wanted, name))) +
          (year !== null && found === year ? YEAR_BONUS : 0),
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.entry ?? candidates[0];
};

/**
 * Builds the address of a catalogue image at a width worth fetching — the catalogue offers sizes up
 * to originals measured in megabytes, and a poster in a grid is a few hundred pixels wide.
 *
 * @param base - Where the catalogue serves its images from.
 * @param path - The image path the catalogue gave.
 * @param size - Which of the catalogue's sizes to ask for.
 * @returns The full address, or null where the catalogue gave no image.
 */
const imageUrl = (base: string, path: string | null | undefined, size: string): string | null =>
  path === null || path === undefined || path === '' ? null : `${base}/${size}${path}`;

/**
 * Reads metadata from an online catalogue — descriptions, cast, artwork, ratings — for files whose
 * names alone say little. Everything it answers with is chosen against what the filename said, and a
 * catalogue that is unreachable, throttled or simply ignorant of a file leaves the filename reader's
 * answer standing rather than failing the scan.
 *
 * @param options - The credential to use, which catalogue to ask, and how to report a problem.
 * @returns The provider, ready to be asked about files.
 */
const createCatalogueMetadataProvider = ({
  readApiKey,
  baseUrl = DEFAULT_BASE_URL,
  imageBaseUrl = DEFAULT_IMAGE_BASE_URL,
  fetchImpl,
  onProblem,
}: CreateCatalogueMetadataProviderOptions): MetadataProvider => {
  const call: Fetcher =
    fetchImpl ??
    (async (url: string, headers?: Record<string, string>) => {
      const response = await fetch(url, headers === undefined ? {} : { headers });

      return {
        ok: response.ok,
        status: response.status,
        json: async (): Promise<JsonValue> => JsonValueSchema.parse(await response.json()),
      };
    });

  const request = async (path: string, key: string, query: Record<string, string>) => {
    const isToken = isAccessToken(key);
    const parameters = new URLSearchParams(isToken ? query : { api_key: key, ...query });

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const response = await call(
        `${baseUrl}${path}?${parameters.toString()}`,
        isToken ? { authorization: `Bearer ${key}` } : undefined,
      );

      if (response.ok) {
        return response.json();
      }

      if (!isWorthRetrying(response.status) || attempt === RETRIES) {
        onProblem?.(`The catalogue answered ${response.status.toString()} for ${path}.`);

        return null;
      }

      await wait(BACKOFF_MILLISECONDS * 2 ** attempt);
    }

    return null;
  };

  return {
    name: 'catalogue',

    describe: async (facts) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return null;
      }

      const episodeNumber = facts.episode?.episodeNumber ?? null;
      const isEpisode = episodeNumber !== null;
      const fromFilename = readTitleFromPath(facts.path);
      const searchTitle = isEpisode
        ? (facts.episode?.seriesTitle ?? fromFilename.title)
        : fromFilename.title;

      /**
       * Turns a catalogue entry into the metadata Valence stores, taking only the fields it has a use for
       * and building full addresses for the artwork.
       *
       * @param detail - The catalogue's own record.
       * @param isTheRightSeries - Whether it is a film or a programme, which decides where the title lives.
       * @returns The metadata to store against the file.
       */
      const describeFrom = async (
        detail: z.infer<typeof DetailResponseSchema>,
        isTheRightSeries = false,
      ): Promise<Metadata | null> => {
        const cast: CastMember[] =
          detail.credits?.cast.slice(0, CAST_STORED).map((member) => ({
            personId: member.id ?? null,
            name: member.name,
            role: member.character ?? '',
            imageUrl: imageUrl(imageBaseUrl, member.profile_path, 'w185'),
          })) ?? [];

        const poster = imageUrl(imageBaseUrl, detail.poster_path, 'w500');

        const episode = isEpisode
          ? EpisodeResponseSchema.safeParse(
              await request(
                `/tv/${detail.id.toString()}/season/${(facts.episode?.seasonNumber ?? 1).toString()}/episode/${episodeNumber.toString()}`,
                key,
                {},
              ),
            )
          : null;

        const knownEpisodeTitle = facts.episode?.episodeTitle ?? null;
        const catalogueEpisodeName =
          episode?.success === true && episode.data.name !== undefined && episode.data.name !== ''
            ? episode.data.name
            : null;

        if (
          isEpisode &&
          !isTheRightSeries &&
          knownEpisodeTitle !== null &&
          catalogueEpisodeName !== null &&
          !shareASignificantWord(knownEpisodeTitle, catalogueEpisodeName)
        ) {
          return null;
        }

        const still =
          episode?.success === true
            ? imageUrl(imageBaseUrl, episode.data.still_path, 'w780')
            : null;
        const backdrop = still ?? imageUrl(imageBaseUrl, detail.backdrop_path, 'w1280');

        const seriesName = detail.title ?? detail.name ?? searchTitle;
        const episodeName = catalogueEpisodeName ?? knownEpisodeTitle;

        const overview =
          episode?.success === true &&
          episode.data.overview !== undefined &&
          episode.data.overview !== ''
            ? episode.data.overview
            : detail.overview;

        return {
          title: isEpisode ? (episodeName ?? seriesName) : seriesName,
          ...(isEpisode ? { seriesTitle: seriesName } : {}),
          year: readYear(detail.release_date ?? detail.first_air_date),
          externalId: detail.id.toString(),
          ...(overview === undefined || overview === '' ? {} : { overview }),
          ...(detail.tagline === undefined || detail.tagline === ''
            ? {}
            : { tagline: detail.tagline }),
          ...(detail.genres.length === 0
            ? {}
            : { genres: detail.genres.map((genre) => genre.name) }),
          ...(cast.length === 0 ? {} : { cast }),
          ...(detail.vote_average === undefined ? {} : { rating: detail.vote_average }),
          ...(poster === null ? {} : { posterUrl: poster }),
          ...(backdrop === null ? {} : { backdropUrl: backdrop }),
        };
      };

      if (
        facts.knownExternalId !== undefined &&
        facts.knownExternalId !== null &&
        facts.knownExternalId !== ''
      ) {
        const detailed = await request(
          `/${facts.knownExternalKind ?? (isEpisode ? 'tv' : 'movie')}/${facts.knownExternalId}`,
          key,
          { append_to_response: 'credits' },
        );

        const detail = DetailResponseSchema.safeParse(detailed);

        if (detail.success) {
          return describeFrom(detail.data, true);
        }
      }

      const seriesYear = facts.episode?.seriesYear ?? null;
      const searched = await request(isEpisode ? '/search/tv' : '/search/movie', key, {
        query: searchTitle,
        ...(isEpisode
          ? seriesYear === null
            ? {}
            : { first_air_date_year: seriesYear.toString() }
          : fromFilename.year === null
            ? {}
            : { year: fromFilename.year.toString() }),
      });

      if (searched === null) {
        return null;
      }

      const results = SearchResponseSchema.safeParse(searched);
      const candidates = results.success ? results.data.results : [];

      const wanted = normalizeTitle(searchTitle);
      const exact =
        wanted === ''
          ? undefined
          : candidates.find((entry) => normalizeTitle(entry.title ?? entry.name ?? '') === wanted);
      const first =
        exact ?? pickBestMatch(candidates, searchTitle, seriesYear ?? fromFilename.year ?? null);

      if (first === undefined) {
        return null;
      }

      const detailed = await request(
        `${isEpisode ? '/tv' : '/movie'}/${first.id.toString()}`,
        key,
        { append_to_response: 'credits' },
      );

      const detail = DetailResponseSchema.safeParse(detailed);

      if (!detail.success) {
        return {
          title: first.title ?? first.name ?? searchTitle,
          year: readYear(first.release_date ?? first.first_air_date),
          externalId: first.id.toString(),
        };
      }

      return describeFrom(detail.data, exact !== undefined);
    },

    readPerson: async (personId) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return null;
      }

      const found = PersonResponseSchema.safeParse(
        await request(`/person/${personId.toString()}`, key, {}),
      );

      if (!found.success) {
        return null;
      }

      const said = found.data;

      return {
        id: said.id,
        name: said.name,
        portraitUrl: imageUrl(imageBaseUrl, said.profile_path, 'w300'),
        biography: said.biography === undefined || said.biography === '' ? null : said.biography,
        bornOn: said.birthday ?? null,
        bornIn: said.place_of_birth ?? null,
      };
    },

    readLogoUrl: async ({ externalId, isSeries }) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return null;
      }

      const path = `/${isSeries ? 'tv' : 'movie'}/${externalId}/images`;

      /**
       * Asks the catalogue for logos twice: first in the language the library prefers, then without a
       * language at all. One request cannot express "this language, or failing that anything", and asking
       * wide first means taking whichever logo the catalogue happens to list first.
       *
       * @param query - Which languages to ask for, in the catalogue's own terms.
       * @returns Every logo found, the preferred language first.
       */
      const readLogos = async (query: Record<string, string>) => {
        const images = ImagesResponseSchema.safeParse(await request(path, key, query));

        return images.success ? images.data.logos : [];
      };

      const found = await readLogos({ include_image_language: 'en,null' });
      const logos = found.length > 0 ? found : await readLogos({});

      const chosen = pickLogo(
        logos.map((logo) => ({
          filePath: logo.file_path,
          language: logo.iso_639_1 ?? null,
          width: logo.width,
          voteAverage: logo.vote_average,
        })),
      );

      return chosen === null ? null : imageUrl(imageBaseUrl, chosen.filePath, 'w500');
    },

    search: async (query, kind) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return [];
      }

      const searched = await request(`/search/${kind}`, key, { query });
      const results = SearchResponseSchema.safeParse(searched);

      if (!results.success) {
        return [];
      }

      return results.data.results.map((entry) => ({
        externalId: entry.id.toString(),
        kind,
        title: entry.title ?? entry.name ?? query,
        year: readYear(entry.release_date ?? entry.first_air_date),
        overview: entry.overview === undefined || entry.overview === '' ? null : entry.overview,
        posterUrl: imageUrl(imageBaseUrl, entry.poster_path, 'w342'),
      }));
    },

    describeSeries: async (externalId) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return null;
      }

      const detailed = await request(`/tv/${externalId}`, key, {});
      const detail = DetailResponseSchema.safeParse(detailed);

      if (!detail.success) {
        return null;
      }

      const seasons = await Promise.all(
        detail.data.seasons.map(async (season) => {
          const listed = SeasonResponseSchema.safeParse(
            await request(`/tv/${externalId}/season/${season.season_number.toString()}`, key, {}),
          );

          return {
            seasonNumber: season.season_number,
            episodeCount: season.episode_count,
            episodes: !listed.success
              ? []
              : listed.data.episodes.map((episode) => ({
                  episodeNumber: episode.episode_number,
                  title:
                    episode.name === undefined || episode.name === ''
                      ? `Episode ${episode.episode_number.toString()}`
                      : episode.name,
                  stillUrl: imageUrl(imageBaseUrl, episode.still_path, 'w780'),
                  overview:
                    episode.overview === undefined || episode.overview === ''
                      ? null
                      : episode.overview,
                })),
          };
        }),
      );

      return { seasons };
    },
  };
};

export type { Fetcher };

export {
  createCatalogueMetadataProvider,
  readYear,
  imageUrl,
  normalizeTitle,
  significantWords,
  shareASignificantWord,
  similarity,
  isAccessToken,
};
