import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library'

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
  /**
   * Queues a scan and reports the job.
   *
   * Null means there is no such library. The scan itself runs in the
   * background; callers poll rather than wait.
   *
   * A forced scan probes every file again rather than only those whose size
   * or modification time changed.
   */
  scan: (libraryId: string, force?: boolean) => Promise<{ jobId: string; state: string } | null>
  /**
   * How a queued scan is getting on.
   *
   * `processed`/`total` are null until the walk has counted its files, and
   * for a service — like the in-memory one — that never tracked them at all.
   */
  readScanState: (
    jobId: string,
  ) => Promise<{ state: string; processed: number | null; total: number | null }>
  /**
   * Where an item's artwork lives at the catalogue it came from.
   *
   * Answers with nothing when the item has none, which is every item until a
   * metadata provider has been configured.
   */
  readArtworkUrl: (mediaId: string, kind: 'poster' | 'backdrop') => Promise<string | null>
}

const DEFAULT_LIMIT = 60

export type { CreateLibraryInput, LibraryService, ListItemsOptions }

export default { DEFAULT_LIMIT }
