import type { Favourite } from '@ValenceContracts/schemas/Favourite';

type FavouriteService = {
  list: (profileId: string) => Promise<Favourite[]>;
  keep: (profileId: string, mediaId: string) => Promise<void>;
  drop: (profileId: string, mediaId: string) => Promise<void>;
};

export type { FavouriteService };
