import { z } from 'zod';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { readTitleFromPath } from './readTitleFromPath';
import { pickLogo } from './pickLogo';
import type { CastMember, Metadata, MetadataProvider } from './MetadataProvider';

const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Whether a credential is the newer kind.
 */
const isAccessToken = (key: string): boolean => key.split('.').length === 3 && key.startsWith('ey');

const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const CAST_LIMIT = 12;

const RETRIES = 3;

const BACKOFF_MILLISECONDS = 500;

/**
 * Whether answering again is worth anything.
 */
const isWorthRetrying = (status: number): boolean => status === 429 || status >= 500;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

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
 * Reads a year out of a catalogue's date, which may be absent or empty.
 */
const readYear = (date: string | undefined): number | null => {
  const year = Number(date?.slice(0, 4));

  return Number.isInteger(year) && year > 1870 ? year : null;
};

/**
 * A title stripped to the letters and digits in it, in any script.
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
 * The words of a title worth comparing.
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
 * Whether two titles have a real word in common.
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
 * How alike two titles are, from nought to one.
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
 * The likeliest of what a catalogue answered with.
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
 * Builds an image address at a sensible width.
 */
const imageUrl = (base: string, path: string | null | undefined, size: string): string | null =>
  path === null || path === undefined || path === '' ? null : `${base}/${size}${path}`;

/**
 * Metadata from an online catalogue.
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
       * Turns a catalogue entry into metadata.
       */
      const describeFrom = async (
        detail: z.infer<typeof DetailResponseSchema>,
        isTheRightSeries = false,
      ): Promise<Metadata | null> => {
        const cast: CastMember[] =
          detail.credits?.cast.slice(0, CAST_LIMIT).map((member) => ({
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

    readLogoUrl: async ({ externalId, isSeries }) => {
      const key = await readApiKey();

      if (key === null || key === '') {
        return null;
      }

      const path = `/${isSeries ? 'tv' : 'movie'}/${externalId}/images`;

      /**
       * Asked twice rather than once, narrow before wide.
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

export type { CreateCatalogueMetadataProviderOptions, Fetcher };

export {
  createCatalogueMetadataProvider,
  readYear,
  imageUrl,
  normalizeTitle,
  significantWords,
  shareASignificantWord,
  similarity,
  pickBestMatch,
  CAST_LIMIT,
  isAccessToken,
};
