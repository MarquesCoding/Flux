import { serverUrl } from '@FluxClient/query/serverUrl';
import { readFromServer } from '@FluxClient/query/readFromServer';
import { FavouriteListSchema } from '@FluxContracts/schemas/Favourite';

/**
 * Everything this viewer has kept. Kept per profile rather than per account, since what one person in
 * a household wants to come back to is not what another does.
 */
const fetchFavourites = async (): Promise<string[]> => {
  return (await readFromServer('/api/favourites', FavouriteListSchema)).favourites.map(
    (entry) => entry.mediaId,
  );
};

/**
 * Keeps something for this profile, or stops keeping it. One call for both directions, since the
 * gesture in the interface is one control that already knows which way it is going.
 *
 * @param mediaId - The item.
 * @param isKept - Whether it should be kept.
 */
const setFavourite = async (mediaId: string, isKept: boolean): Promise<boolean> => {
  const response = await fetch(serverUrl(`/api/media/${mediaId}/favourite`), {
    method: isKept ? 'PUT' : 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

export { fetchFavourites, setFavourite };
