import type { Favourite } from '@FluxContracts/schemas/Favourite';

/**
 * What each person has kept, as the HTTP layer sees it.
 *
 * Keyed on a profile rather than an account, like watch progress and for the
 * same reason: a household sharing one login does not share one list, and
 * moving somebody to an account of their own carries their list with them.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one.
 */
type FavouriteService = {
  list: (profileId: string) => Promise<Favourite[]>;
  keep: (profileId: string, mediaId: string) => Promise<void>;
  drop: (profileId: string, mediaId: string) => Promise<void>;
};

export type { FavouriteService };
