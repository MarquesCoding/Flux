import { z } from 'zod';

/**
 * Something a viewer has kept.
 *
 * Kept per viewer rather than per account, like everything else about
 * watching: a household sharing a server does not share a taste in films.
 *
 * The item is named by its id alone. A favourite is a mark against something
 * the library already describes, and answering with a copy of that description
 * would leave two accounts of the same item to disagree.
 */
const FavouriteSchema = z.object({
  mediaId: z.string().uuid(),
  keptAt: z.string().datetime(),
});

const FavouriteListSchema = z.object({ favourites: z.array(FavouriteSchema) });

type Favourite = z.infer<typeof FavouriteSchema>;

export type { Favourite };

export { FavouriteSchema, FavouriteListSchema };
