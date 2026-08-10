import type { Library, MediaDetail, MediaSummary, ScanResult } from '@FluxContracts/schemas/Library'

type ListItemsOptions = {
  search?: string
  limit: number
  offset: number
}

type CreateLibraryInput = {
  name: string
  kind: Library['kind']
  path: string
}

/**
 * The library as the HTTP layer sees it.
 *
 * A port rather than a concrete database client, so the routes can be tested
 * without Postgres and so a future plugin-provided library source can satisfy
 * the same shape.
 */
type LibraryService = {
  list: () => Promise<Library[]>
  create: (input: CreateLibraryInput) => Promise<Library | null>
  listItems: (
    libraryId: string,
    options: ListItemsOptions,
  ) => Promise<{ items: MediaSummary[]; total: number } | null>
  getMedia: (id: string) => Promise<MediaDetail | null>
  scan: (libraryId: string) => Promise<ScanResult | null>
}

const DEFAULT_LIMIT = 60

export type { CreateLibraryInput, LibraryService, ListItemsOptions }

export default { DEFAULT_LIMIT }
