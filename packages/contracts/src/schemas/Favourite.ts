import { z } from 'zod';

const FavouriteSchema = z.object({
  mediaId: z.string().uuid(),
  keptAt: z.string().datetime(),
});

const FavouriteListSchema = z.object({ favourites: z.array(FavouriteSchema) });

type Favourite = z.infer<typeof FavouriteSchema>;

export type { Favourite };

export { FavouriteSchema, FavouriteListSchema };
