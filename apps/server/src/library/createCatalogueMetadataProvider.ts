import { z } from 'zod';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { readTitleFromPath } from './readTitleFromPath';
import type { CastMember, Metadata, MetadataProvider } from './MetadataProvider';

/**
 * Where the catalogue lives.
 *
 * Configurable so a deployment can point at a mirror, and so tests can point
 * at nothing at all.
 */
const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Whether a credential is the newer kind.
 *
 * The newer one is a signed token in three dot-separated parts; the older is a
 * plain string of hexadecimal. Telling them apart by shape means an operator
 * never has to know which they were given.
 */
const isAccessToken = (key: string): boolean => key.split('.').length === 3 && key.startsWith('ey');

const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * How many people are worth naming.
 *
 * A film credits hundreds. A viewer deciding whether to watch it reads the
 * first few.
 */
const CAST_LIMIT = 12;

/**
 * How many times a request is tried again before giving up.
 *
 * A catalogue rate-limits a scan long before a library is large, and one
 * refused request used to cost a file its title and its artwork until somebody
 * noticed and scanned again.
 */
const RETRIES = 3;

/**
 * The shortest wait between attempts, doubled each time.
 */
const BACKOFF_MILLISECONDS = 500;

/**
 * Whether answering again is worth anything.
 *
 * Too many requests and a service in trouble will both pass; a refusal or a
 * missing title will not, however many times it is asked.
 */
const isWorthRetrying = (status: number): boolean => status === 429 || status >= 500;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const SearchResultSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  vote_average: z.number().optional(),
});

const SearchResponseSchema = z.object({ results: z.array(SearchResultSchema).default([]) });

/**
 * What the catalogue says about one episode.
 *
 * Asked for separately, because a series entry names the series: without this
 * every episode of a show would be called the same thing, which is exactly
 * what a list of episodes must not be.
 */
const EpisodeResponseSchema = z.object({
  name: z.string().optional(),
  overview: z.string().optional(),
  still_path: z.string().nullish(),
  vote_average: z.number().optional(),
});

/**
 * The episodes of one season, as the catalogue lists them.
 */
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
  /**
   * Read at call time rather than at construction, so an operator adding a key
   * in settings does not have to restart the server.
   */
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
 * A title stripped to the words in it, for comparing two spellings of the
 * same thing rather than two exact strings.
 */
const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Whether two titles have a real word in common.
 *
 * Wording between a release and a catalogue drifts — "Marvel's Daredevil"
 * against "Daredevil" — so exact equality would refuse matches that are
 * plainly right. A word under four letters agrees by accident too often to
 * count as agreement at all.
 */
const shareASignificantWord = (left: string, right: string): boolean => {
  const wordsOf = (value: string): Set<string> =>
    new Set(
      normalizeTitle(value)
        .split(' ')
        .filter((word) => word.length >= 4),
    );

  const leftWords = wordsOf(left);

  return [...wordsOf(right)].some((word) => leftWords.has(word));
};

/**
 * Builds an image address at a sensible width.
 *
 * Catalogues serve originals at print resolution. A poster is drawn a few
 * hundred pixels wide, and fetching eight megabytes to draw it would be
 * absurd.
 */
const imageUrl = (base: string, path: string | null | undefined, size: string): string | null =>
  path === null || path === undefined || path === '' ? null : `${base}/${size}${path}`;

/**
 * Metadata from an online catalogue.
 *
 * This is the plugin shape ADR-0007 describes, living in the server for now
 * because the plugin runtime is not yet carrying providers. Nothing about it
 * assumes it will stay here: it takes its key and its transport as arguments
 * and answers the same `MetadataProvider` contract the filename reader does.
 *
 * Answers with nothing when no key is configured, which is the common case for
 * a fresh install. Talking to a third party about what is in someone's library
 * is a decision the operator makes deliberately, not a default.
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
       *
       * `isTheRightSeries` says whether the series itself is beyond doubt —
       * matched by name exactly, or reached by the id it was matched to
       * before. When it is, an episode addressed by season and number needs no
       * second opinion, and a title that disagrees with the filename means a
       * translated release rather than a wrong match: `Affetto` and
       * `To Affection` are the same episode, and refusing the whole entry over
       * it loses the artwork, the overview and the id along with the name.
       *
       * When the series was only the best of several guesses, the episode
       * title is the one piece of evidence available for whether the guess was
       * right, and a disagreement is still grounds to refuse.
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
      const exact = candidates.find(
        (entry) => normalizeTitle(entry.title ?? entry.name ?? '') === wanted,
      );
      const first = exact ?? candidates[0];

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

export { createCatalogueMetadataProvider, readYear, imageUrl, CAST_LIMIT, isAccessToken };
