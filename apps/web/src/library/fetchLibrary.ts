import { z } from 'zod'
import LibraryContract from '@FluxContracts/schemas/Library'
import type { Library, MediaDetail, MediaPage } from '@FluxContracts/schemas/Library'

const { LibrarySchema, MediaPageSchema, MediaDetailSchema } = LibraryContract

const LibraryListSchema = z.array(LibrarySchema)

type ListItemsOptions = {
  search?: string
  limit?: number
  offset?: number
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
 * takes minutes to walk and probe.
 *
 * A forced scan probes every file again rather than only those that changed on
 * disk, which is what picks up a change in how Flux reads files.
 */
const scanLibrary = async (libraryId: string, force = false): Promise<boolean> => {
  const query = force ? '?force=true' : ''
  const response = await fetch(`/api/libraries/${libraryId}/scan${query}`, { method: 'POST' })

  return response.ok
}

export type { ListItemsOptions }

export default { fetchLibraries, fetchLibraryItems, fetchMediaDetail, scanLibrary }
