import { z } from 'zod'
import LibraryContract from '@FluxContracts/schemas/Library'
import type { Library, LibraryKind, MediaDetail, MediaPage } from '@FluxContracts/schemas/Library'

const { LibrarySchema, MediaPageSchema, MediaDetailSchema } = LibraryContract

const LibraryListSchema = z.array(LibrarySchema)
const ErrorBodySchema = z.object({ error: z.string() })

const ScanStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown'])
const ScanJobSchema = z.object({ jobId: z.string(), state: ScanStateSchema })

type ScanState = z.infer<typeof ScanStateSchema>
type ScanJob = z.infer<typeof ScanJobSchema>

type ListItemsOptions = {
  search?: string
  limit?: number
  offset?: number
}

type CreateLibraryInput = {
  name: string
  kind: LibraryKind
  path: string
}

/**
 * Reads every library on this server.
 */
const fetchLibraries = async (): Promise<Library[]> => {
  const response = await fetch('/api/libraries', { headers: { accept: 'application/json' } })

  if (!response.ok) {
    throw new Error(`Libraries request failed with status ${response.status.toString()}`)
  }

  return LibraryListSchema.parse(await response.json())
}

/**
 * Adds a library root.
 *
 * Surfaces the server's own message on failure — it is the side that checked
 * the path is a readable directory — rather than a generic status code.
 */
const createLibrary = async (input: CreateLibraryInput): Promise<Library> => {
  const response = await fetch('/api/libraries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null))

    throw new Error(
      parsed.success
        ? parsed.data.error
        : `Library request failed with status ${response.status.toString()}`,
    )
  }

  return LibrarySchema.parse(await response.json())
}

/**
 * Reads a page of items from a library.
 *
 * Paging is a server concern rather than a client one: a library of tens of
 * thousands of items must not be shipped whole to draw one screen of posters.
 */
const fetchLibraryItems = async (
  libraryId: string,
  { search, limit = 60, offset = 0 }: ListItemsOptions = {},
): Promise<MediaPage> => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })

  if (search !== undefined && search.trim() !== '') {
    query.set('search', search.trim())
  }

  const response = await fetch(`/api/libraries/${libraryId}/items?${query.toString()}`, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Items request failed with status ${response.status.toString()}`)
  }

  return MediaPageSchema.parse(await response.json())
}

/**
 * Reads everything about one item, including its streams.
 *
 * Kept separate from the grid, which deliberately carries only enough to draw
 * a poster. Answers with nothing rather than throwing: this detail decorates
 * playback and must not be able to stop it.
 */
const fetchMediaDetail = async (mediaId: string): Promise<MediaDetail | null> => {
  try {
    const response = await fetch(`/api/media/${mediaId}`, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    return MediaDetailSchema.parse(await response.json())
  } catch {
    return null
  }
}

/**
 * Asks the server to queue a rescan.
 *
 * Answers as soon as the scan is queued, not when it finishes: a real library
 * takes minutes to walk and probe. Returns the job so a caller that wants to
 * know when the walk is actually done can poll `readScanState`.
 *
 * A forced scan probes every file again rather than only those that changed on
 * disk, which is what picks up a change in how Flux reads files.
 */
const scanLibrary = async (libraryId: string, force = false): Promise<ScanJob | null> => {
  const query = force ? '?force=true' : ''
  const response = await fetch(`/api/libraries/${libraryId}/scan${query}`, { method: 'POST' })

  if (!response.ok) {
    return null
  }

  return ScanJobSchema.parse(await response.json())
}

/**
 * Reads how a queued scan is getting on.
 *
 * A scan the server no longer knows about — restarted since, or the id was
 * never real — is reported as `unknown` rather than thrown on, since that is
 * itself a terminal answer: whatever was watching it should stop.
 */
const readScanState = async (jobId: string): Promise<ScanState> => {
  const response = await fetch(`/api/libraries/scans/${jobId}`, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    return 'unknown'
  }

  return ScanJobSchema.parse(await response.json()).state
}

export type { ListItemsOptions, CreateLibraryInput, ScanJob, ScanState }

export default {
  fetchLibraries,
  createLibrary,
  fetchLibraryItems,
  fetchMediaDetail,
  scanLibrary,
  readScanState,
}
