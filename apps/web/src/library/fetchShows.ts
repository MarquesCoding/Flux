import { ShowListSchema, ShowDetailSchema } from '@FluxContracts/schemas/Show'
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show'

/**
 * The series in a library.
 *
 * Answers with nothing rather than throwing, like every other read a page
 * makes: a shelf of shows is one row of a page, and its absence must not take
 * the page down with it.
 */
const fetchShows = async (libraryId: string): Promise<ShowSummary[]> => {
  try {
    const response = await fetch(`/api/libraries/${libraryId}/shows`, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return ShowListSchema.parse(await response.json()).shows
  } catch {
    return []
  }
}

/**
 * One series and everything the library holds of it.
 */
const fetchShow = async (libraryId: string, showId: string): Promise<ShowDetail | null> => {
  try {
    const response = await fetch(`/api/libraries/${libraryId}/shows/${showId}`, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    return ShowDetailSchema.parse(await response.json())
  } catch {
    return null
  }
}

export { fetchShows, fetchShow }
