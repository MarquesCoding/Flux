import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library'
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show'

type ListItemsOptions = {
  search?: string
  /**
   * Whether to answer with films or with episodes.
   *
   * Told apart by whether a file belongs to a series, which is the only thing
   * the library actually knows: a folder of films and a folder of programmes
   * are the same shape on disk.
   */
  kind?: 'films' | 'shows'
  /**
   * A genre the item must carry, as a catalogue named it.
   */
  genre?: string
  /**
   * Particular items, named outright.
   *
   * For a page built from a list somebody keeps elsewhere — what they have
   * favourited — where the ids are known and the descriptions are not. Asking
   * for them by name beats reading the library and sifting it, which answers
   * with whatever the first page happened to hold.
   */
  ids?: string[]
  /**
   * What order to answer in.
   *
   * By title unless asked otherwise, because a page of things to browse reads
   * as a list rather than as a heap. Newest first is for the page that is
   * about newness.
   */
  order?: 'title' | 'newest'
  limit: number
  offset: number
}

/**
 * What the library can be asked about series rather than about files.
 *
 * A show is not stored anywhere: it is every item naming the same series. The
 * grouping is done here rather than in a browser because a page holds the
 * first sixty things it was sent, and a series with ninety episodes would
 * otherwise report itself as having thirty.
 */
type ShowService = {
  listShows: (libraryId: string) => Promise<ShowSummary[] | null>
  getShow: (libraryId: string, showId: string) => Promise<ShowDetail | null>
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
type LibraryService = ShowService & {
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
   * Deletes every item in a library, then queues a scan to repopulate it
   * from nothing.
   *
   * Null means there is no such library. As destructive as it sounds — an
   * operator reaching for this wants a clean rebuild, not a delta against
   * whatever the database currently believes.
   */
  reset: (libraryId: string) => Promise<{ jobId: string; state: string } | null>
  /**
   * How a queued scan is getting on.
   *
   * `phase`/`processed`/`total` are null until the scan has reported
   * anything, and for a service — like the in-memory one — that never
   * tracked them at all.
   */
  readScanState: (jobId: string) => Promise<{
    state: string
    phase: string | null
    processed: number | null
    total: number | null
  }>
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
