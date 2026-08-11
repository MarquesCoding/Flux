import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library'

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

type CreateLibraryInput = {
  name: string
  kind: Library['kind']
  path: string
}

type UpdateLibraryInput = {
  defaultAudioLanguage: string | null
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
  /**
   * Changes a library's settings, such as which language its audio track
   * selection should prefer.
   *
   * Null means there is no such library.
   */
  update: (libraryId: string, input: UpdateLibraryInput) => Promise<Library | null>
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
   * Queues preview regeneration against the library's current forced audio
   * language, without a full rescan.
   *
   * Null means there is no such library.
   */
  regeneratePreviews: (libraryId: string) => Promise<{ jobId: string; state: string } | null>
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

export type { CreateLibraryInput, LibraryService, ListItemsOptions, UpdateLibraryInput }

export default { DEFAULT_LIMIT }
