import { z } from 'zod'
import JsonValueModule from '@FluxContracts/schemas/JsonValue'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'
import readTitleFromPathModule from './readTitleFromPath'
import type { CastMember, Metadata, MetadataProvider } from './MetadataProvider'

const { readTitleFromPath } = readTitleFromPathModule
const { JsonValueSchema } = JsonValueModule

/**
 * Where the catalogue lives.
 *
 * Configurable so a deployment can point at a mirror, and so tests can point
 * at nothing at all.
 */
const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3'

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
    (async (url: string) => {
      const response = await fetch(url)

      return {
        ok: response.ok,
        status: response.status,
        // Parsed by a schema at the call site, so the body arriving as any
        // shape at all is expected rather than a hole in the typing.
        json: async (): Promise<JsonValue> => JsonValueSchema.parse(await response.json()),
      }
    })

  const request = async (path: string, key: string, query: Record<string, string>) => {
    const parameters = new URLSearchParams({ api_key: key, ...query })
    const response = await call(`${baseUrl}${path}?${parameters.toString()}`)

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

      const searched = await request(isEpisode ? '/search/tv' : '/search/movie', key, {
        query: searchTitle,
        ...(fromFilename.year === null || isEpisode ? {} : { year: fromFilename.year.toString() }),
      })

      if (searched === null) {
        return null
      }

      const results = SearchResponseSchema.safeParse(searched)
      const first = results.success ? results.data.results[0] : undefined

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

      const found = detail.data
      const cast: CastMember[] =
        found.credits?.cast.slice(0, CAST_LIMIT).map((member) => ({
          name: member.name,
          role: member.character ?? '',
          imageUrl: imageUrl(imageBaseUrl, member.profile_path, 'w185'),
        })) ?? []

      const poster = imageUrl(imageBaseUrl, found.poster_path, 'w500')
      const backdrop = imageUrl(imageBaseUrl, found.backdrop_path, 'w1280')

      const metadata: Metadata = {
        title: found.title ?? found.name ?? searchTitle,
        year: readYear(found.release_date ?? found.first_air_date),
        externalId: found.id.toString(),
        ...(found.overview === undefined || found.overview === ''
          ? {}
          : { overview: found.overview }),
        ...(found.tagline === undefined || found.tagline === '' ? {} : { tagline: found.tagline }),
        ...(found.genres.length === 0 ? {} : { genres: found.genres.map((genre) => genre.name) }),
        ...(cast.length === 0 ? {} : { cast }),
        ...(found.vote_average === undefined ? {} : { rating: found.vote_average }),
        ...(poster === null ? {} : { posterUrl: poster }),
        ...(backdrop === null ? {} : { backdropUrl: backdrop }),
      }

      return metadata
    },
  }
}

export type { CreateCatalogueMetadataProviderOptions, Fetcher }

export default { createCatalogueMetadataProvider, readYear, imageUrl, CAST_LIMIT }
