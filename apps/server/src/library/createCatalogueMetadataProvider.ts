import { z } from 'zod'
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'
import { readTitleFromPath } from './readTitleFromPath'
import type { CastMember, Metadata, MetadataProvider } from './MetadataProvider'

/**
 * Where the catalogue lives.
 *
 * Configurable so a deployment can point at a mirror, and so tests can point
 * at nothing at all.
 */
const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * Whether a credential is the newer kind.
 *
 * The newer one is a signed token in three dot-separated parts; the older is a
 * plain string of hexadecimal. Telling them apart by shape means an operator
 * never has to know which they were given.
 */
const isAccessToken = (key: string): boolean => key.split('.').length === 3 && key.startsWith('ey')

const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

/**
 * How many people are worth naming.
 *
 * A film credits hundreds. A viewer deciding whether to watch it reads the
 * first few.
 */
const CAST_LIMIT = 12

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
})

const SearchResponseSchema = z.object({ results: z.array(SearchResultSchema).default([]) })

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
})

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
})

type Fetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

type CreateCatalogueMetadataProviderOptions = {
  /**
   * Read at call time rather than at construction, so an operator adding a key
   * in settings does not have to restart the server.
   */
  readApiKey: () => Promise<string | null>
  baseUrl?: string
  imageBaseUrl?: string
  fetchImpl?: Fetcher
  onProblem?: (reason: string) => void
}

/**
 * Reads a year out of a catalogue's date, which may be absent or empty.
 */
const readYear = (date: string | undefined): number | null => {
  const year = Number(date?.slice(0, 4))

  return Number.isInteger(year) && year > 1870 ? year : null
}

/**
 * A title stripped to the words in it, for comparing two spellings of the
 * same thing rather than two exact strings.
 */
const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

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
    )

  const leftWords = wordsOf(left)

  return [...wordsOf(right)].some((word) => leftWords.has(word))
}

/**
 * Builds an image address at a sensible width.
 *
 * Catalogues serve originals at print resolution. A poster is drawn a few
 * hundred pixels wide, and fetching eight megabytes to draw it would be
 * absurd.
 */
const imageUrl = (base: string, path: string | null | undefined, size: string): string | null =>
  path === null || path === undefined || path === '' ? null : `${base}/${size}${path}`

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
      const response = await fetch(url, headers === undefined ? {} : { headers })

      return {
        ok: response.ok,
        status: response.status,
        // Parsed by a schema at the call site, so the body arriving as any
        // shape at all is expected rather than a hole in the typing.
        json: async (): Promise<JsonValue> => JsonValueSchema.parse(await response.json()),
      }
    })

  const request = async (path: string, key: string, query: Record<string, string>) => {
    // The catalogue issues two kinds of credential and does not accept them
    // the same way: the older one is a key in the query string, and the newer
    // one is a token in a header. Somebody pasting either should get their
    // posters, rather than a silent four hundred and one.
    const isToken = isAccessToken(key)
    const parameters = new URLSearchParams(isToken ? query : { api_key: key, ...query })

    const response = await call(
      `${baseUrl}${path}?${parameters.toString()}`,
      isToken ? { authorization: `Bearer ${key}` } : undefined,
    )

    if (!response.ok) {
      onProblem?.(`The catalogue answered ${response.status.toString()} for ${path}.`)

      return null
    }

    return response.json()
  }

  return {
    name: 'catalogue',

    describe: async (facts) => {
      const key = await readApiKey()

      if (key === null || key === '') {
        return null
      }

      const episodeNumber = facts.episode?.episodeNumber ?? null
      const isEpisode = episodeNumber !== null
      const fromFilename = readTitleFromPath(facts.path)
      const searchTitle = isEpisode
        ? (facts.episode?.seriesTitle ?? fromFilename.title)
        : fromFilename.title

      // The tail shared by both a known id and a freshly searched one: fetch
      // the episode underneath it, cross-check its title, and shape whatever
      // is left into what a caller actually wants.
      const describeFrom = async (
        detail: z.infer<typeof DetailResponseSchema>,
      ): Promise<Metadata | null> => {
        const cast: CastMember[] =
          detail.credits?.cast.slice(0, CAST_LIMIT).map((member) => ({
            name: member.name,
            role: member.character ?? '',
            imageUrl: imageUrl(imageBaseUrl, member.profile_path, 'w185'),
          })) ?? []

        const poster = imageUrl(imageBaseUrl, detail.poster_path, 'w500')

        // An episode is named by the episode, illustrated by its own still, and
        // described by its own synopsis — falling back to the series for
        // whichever of those the catalogue does not have.
        const episode = isEpisode
          ? EpisodeResponseSchema.safeParse(
              await request(
                `/tv/${detail.id.toString()}/season/${(facts.episode?.seasonNumber ?? 1).toString()}/episode/${episodeNumber.toString()}`,
                key,
                {},
              ),
            )
          : null

        // A second check, past the series title: two shows can share a name, or
        // neither search result may have matched exactly, and either way the
        // wrong series answers with a real episode at this season and number —
        // just not the one the filename already named. Refusing here falls
        // back to what the filename said, rather than keeping a confident
        // answer about the wrong show.
        const knownEpisodeTitle = facts.episode?.episodeTitle ?? null
        const catalogueEpisodeName =
          episode?.success === true && episode.data.name !== undefined && episode.data.name !== ''
            ? episode.data.name
            : null

        if (
          isEpisode &&
          knownEpisodeTitle !== null &&
          catalogueEpisodeName !== null &&
          !shareASignificantWord(knownEpisodeTitle, catalogueEpisodeName)
        ) {
          return null
        }

        const still =
          episode?.success === true ? imageUrl(imageBaseUrl, episode.data.still_path, 'w780') : null
        const backdrop = still ?? imageUrl(imageBaseUrl, detail.backdrop_path, 'w1280')

        const seriesName = detail.title ?? detail.name ?? searchTitle
        const episodeName = catalogueEpisodeName ?? knownEpisodeTitle

        const overview =
          episode?.success === true &&
          episode.data.overview !== undefined &&
          episode.data.overview !== ''
            ? episode.data.overview
            : detail.overview

        return {
          title: isEpisode ? (episodeName ?? seriesName) : seriesName,
          // The show is what a series of files belongs to, and what a shelf
          // groups them under.
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
        }
      }

      // A rescan asking about something already matched skips search
      // entirely and goes straight to what a provider already said this
      // was — the same search that risks a mismatch does not run again on
      // every rescan for the rest of this item's life.
      if (
        facts.knownExternalId !== undefined &&
        facts.knownExternalId !== null &&
        facts.knownExternalId !== ''
      ) {
        const detailed = await request(
          `${isEpisode ? '/tv' : '/movie'}/${facts.knownExternalId}`,
          key,
          { append_to_response: 'credits' },
        )

        const detail = DetailResponseSchema.safeParse(detailed)

        if (detail.success) {
          return describeFrom(detail.data)
        }

        // The id no longer resolves — removed from the catalogue, or merged
        // into another. Falls through to search rather than giving up, the
        // same as an item that has never been matched before.
      }

      const seriesYear = facts.episode?.seriesYear ?? null
      const searched = await request(isEpisode ? '/search/tv' : '/search/movie', key, {
        query: searchTitle,
        ...(isEpisode
          ? seriesYear === null
            ? {}
            : { first_air_date_year: seriesYear.toString() }
          : fromFilename.year === null
            ? {}
            : { year: fromFilename.year.toString() }),
      })

      if (searched === null) {
        return null
      }

      const results = SearchResponseSchema.safeParse(searched)
      const candidates = results.success ? results.data.results : []

      // The catalogue sorts by popularity, not by which title matches best —
      // searching "Ted" can rank "Ted Lasso" above "Ted" itself. An exact
      // title is trusted over the ranking whenever the search actually found
      // one, and only falls back to "whatever came first" when it did not.
      const wanted = normalizeTitle(searchTitle)
      const exact = candidates.find(
        (entry) => normalizeTitle(entry.title ?? entry.name ?? '') === wanted,
      )
      const first = exact ?? candidates[0]

      if (first === undefined) {
        return null
      }

      const detailed = await request(
        `${isEpisode ? '/tv' : '/movie'}/${first.id.toString()}`,
        key,
        { append_to_response: 'credits' },
      )

      const detail = DetailResponseSchema.safeParse(detailed)

      if (!detail.success) {
        // The search found something even if the details did not arrive, so
        // answer with what is known rather than falling through to a filename.
        return {
          title: first.title ?? first.name ?? searchTitle,
          year: readYear(first.release_date ?? first.first_air_date),
          externalId: first.id.toString(),
        }
      }

      return describeFrom(detail.data)
    },
  }
}

export type { CreateCatalogueMetadataProviderOptions, Fetcher }

export { createCatalogueMetadataProvider, readYear, imageUrl, CAST_LIMIT }
