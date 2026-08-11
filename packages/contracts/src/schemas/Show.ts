import { z } from 'zod';
import { MediaSummarySchema } from './Library';

/**
 * A series, as the library sees one.
 *
 * Not a row in any table: a show is every file that names the same series, so
 * what is known about it is what its episodes agree on. The identifier is its
 * title made safe for an address, which is the only stable name it has.
 */
const ShowSummarySchema = z.object({
  id: z.string().min(1),
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  seasonCount: z.number().int().nonnegative(),
  episodeCount: z.number().int().nonnegative(),
  latestAddedAt: z.string(),
  coverMediaId: z.string().uuid(),
  year: z.number().int().nullish(),
  rating: z.number().nullish(),
  genres: z.array(z.string()).nullish(),
});

/**
 * A season of one, with the episodes in the order they are watched.
 */
const ShowSeasonSchema = z.object({
  seasonNumber: z.number().int().nullable(),
  episodes: z.array(MediaSummarySchema),
});

/**
 * Everything the library holds about a series.
 */
const ShowDetailSchema = ShowSummarySchema.extend({
  seasons: z.array(ShowSeasonSchema),
});

const ShowListSchema = z.object({ shows: z.array(ShowSummarySchema) });

type ShowSummary = z.infer<typeof ShowSummarySchema>;
type ShowSeason = z.infer<typeof ShowSeasonSchema>;
type ShowDetail = z.infer<typeof ShowDetailSchema>;

export type { ShowDetail, ShowSeason, ShowSummary };

export { ShowSummarySchema, ShowSeasonSchema, ShowDetailSchema, ShowListSchema };
