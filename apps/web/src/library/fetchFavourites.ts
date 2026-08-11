import FavouriteContract from '@FluxContracts/schemas/Favourite'

const { FavouriteListSchema } = FavouriteContract

/**
 * Everything this viewer has kept.
 *
 * Answers with nothing rather than throwing, like every other read a page
 * makes: a list of favourites is a decoration on a library, and its absence
 * must not take the library down with it.
 */
const fetchFavourites = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/favourites', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return FavouriteListSchema.parse(await response.json()).favourites.map((entry) => entry.mediaId)
  } catch {
    return []
  }
}

/**
 * Keeps something, or stops keeping it.
 *
 * One function rather than two, because there is one gesture: a heart that is
 * pressed. Answers with whether the server agreed, so a page that guessed can
 * put itself right.
 */
const setFavourite = async (mediaId: string, isKept: boolean): Promise<boolean> => {
  const response = await fetch(`/api/media/${mediaId}/favourite`, {
    method: isKept ? 'PUT' : 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null)

  return response !== null && response.ok
}

export default { fetchFavourites, setFavourite }
