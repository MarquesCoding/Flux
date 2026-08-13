import { z } from 'zod';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { readTitleFromPath } from './readTitleFromPath';
import { pickLogo } from './pickLogo';
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

/**
 * One answer from a catalogue's search.
 *
 * Both the localised name and the original are asked for, because a
 * self-hosted library is full of releases named the way they were made while a
 * catalogue answers in English: the file says
 * `Yamada kun to Lv999 no Koi wo Suru` and the catalogue says
 * `My Love Story with Yamada-kun at Lv999`, which share almost no letters at
 * all. Holding both means a release named either way can find itself.
 */
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
 * A title stripped to the letters and digits in it, in any script.
 *
 * Letters as Unicode understands them rather than as ASCII does. Stripping
 * everything outside `a-z0-9` does not tidy a Japanese, Korean, Chinese,
 * Russian or Greek title — it deletes it, leaving an empty string that
 * compares equal to every other title in the same position. Two unrelated
 * films then look identical, which is a worse answer than no answer.
 *
 * `NFKC` first, because the same string can be encoded more than one way — a
 * composed accent against a combining one, a full-width Latin letter against
 * its ordinary form — and two titles that look identical should not fail to
 * match over how somebody's tooling wrote them down.
 *
 * `toLowerCase` rather than `toLocaleLowerCase`, deliberately. The locale-aware
 * form folds `I` differently under a Turkish locale, which would make matching
 * depend on the locale of the machine the server happens to run on: two
 * installs would disagree about the same file. Unicode's locale-independent
 * mapping already handles every script here.
 */
const normalizeTitle = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Scripts that carry a word's worth of meaning in one or two characters.
 */
const DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * How long a word must be before agreeing on it means anything.
 *
 * Four for a script that writes with spaces: "the", "of" and "war" agree by
 * accident far too often to count. Two where a couple of characters is a whole
 * word — 君の名は is four characters and three words — because a threshold
 * tuned for English discards everything meaningful in Japanese, Chinese and
 * Korean, and then nothing ever agrees at all.
 */
const LEAST_MEANINGFUL = 4;
const LEAST_MEANINGFUL_DENSE = 2;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'word' });

/**
 * The words of a title worth comparing.
 *
 * Segmented rather than split on spaces, because plenty of scripts do not use
 * them: splitting 君の名は on spaces yields one long "word", and splitting
 * 기생충 yields one short one that the length rule then throws away.
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
 *
 * Wording between a release and a catalogue drifts — "Marvel's Daredevil"
 * against "Daredevil" — so exact equality would refuse matches that are
 * plainly right.
 *
 * A title this cannot read is let through rather than refused. The question
 * exists to throw out a match that is plainly wrong, and a test that answers
 * "no words in common" for every title in a script is not evidence about the
 * match — it is the test failing to apply. Refusing on it threw away every
 * episode of every foreign-language programme.
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
 *
 * Compared as overlapping letter pairs rather than as whole strings, which is
 * what makes it forgiving of the ways a release and a catalogue disagree:
 * punctuation, a dropped article, a transliteration one letter out, an
 * accented vowel spelled flat. "Yamada kun to Lv999 no Koi wo Suru" against
 * "My Love Story with Yamada-kun at Lv999" still shares enough to beat the
 * unrelated results around it.
 *
 * Pairs rather than words because the disagreements are usually inside the
 * words. Counting whole words matched "Marvel's Daredevil" to "Daredevil" and
 * nothing else, which is why the exact-match test needed a second guard beside
 * it in the first place.
 */
const similarity = (left: string, right: string): number => {
  const pairsOf = (value: string): string[] => {
    const clean = normalizeTitle(value).replace(/ /g, '');

    return [...clean].slice(0, -1).map((letter, at) => `${letter}${clean[at + 1] ?? ''}`);
  };

  const leftPairs = pairsOf(left);
  const rightPairs = pairsOf(right);

  if (leftPairs.length === 0 || rightPairs.length === 0) {
    /**
     * Nothing to compare, so agreement has to be exact and to be of something.
     *
     * Two titles that normalise to nothing are not the same title — they are
     * two titles this cannot read, which is the opposite of evidence. Answering
     * one for that scored every foreign-language candidate a perfect match and
     * handed the wrong film the top of the list with complete confidence.
     */
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

/**
 * How much a candidate agreeing on the year is worth.
 *
 * Enough to separate two versions of the same title and not enough to promote
 * something that is not the title at all — remakes exist, and so do releases
 * whose filename year is the year somebody encoded it.
 */
const YEAR_BONUS = 0.15;

/**
 * The likeliest of what a catalogue answered with.
 *
 * A catalogue orders its results by how popular they are, not by how well they
 * answer the question, so taking the first was taking the most famous thing
 * that shared a word with the filename. That is exactly the wrong tie-break
 * for a self-hosted library, which is full of the obscure and the foreign.
 *
 * Falls back to the catalogue's own order when nothing scores at all, since a
 * poor answer that can be corrected beats no answer at all.
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

      /**
       * The candidate whose title is the one being looked for.
       *
       * Only when there is a title to look for. An empty one matches the first
       * candidate that is also empty, which is not agreement — it is two
       * strings this could not read, promoted over the catalogue's own ranking
       * as though they were a certainty.
       */
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
       *
       * A plain request answers with only the images matching the account's
       * own language, so a programme whose lettering is catalogued in its
       * original tongue looks as though it has none at all — which is what it
       * looks like from outside, and the wrong conclusion. Asking with no
       * filter first would work, but it would also spend the choice on every
       * title that has a perfectly good English logo sitting there. So: ask
       * for what is wanted, and only widen when the answer is nothing.
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
