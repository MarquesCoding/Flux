import { FavouriteListSchema } from '@FluxContracts/schemas/Favourite';

/**
 * Everything this viewer has kept.
 */
const fetchFavourites = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/favourites', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return FavouriteListSchema.parse(await response.json()).favourites.map(
      (entry) => entry.mediaId,
    );
  } catch {
    return [];
  }
};

/**
 * Keeps something for this profile, or stops keeping it.
 *
 * @param mediaId - The item.
 * @param isKept - Whether it should be kept.
 */
const setFavourite = async (mediaId: string, isKept: boolean): Promise<boolean> => {
  const response = await fetch(`/api/media/${mediaId}/favourite`, {
    method: isKept ? 'PUT' : 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

export { fetchFavourites, setFavourite };
