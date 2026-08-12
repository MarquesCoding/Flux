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
 * What a catalogue says a season of the series contains.
 *
 * The count is what should be there, against which what is held can be
 * measured. Season nought is the specials, which a catalogue numbers even
 * where the people making them did not.
 */
const CatalogueEpisodeSchema = z.object({
  episodeNumber: z.number().int().positive(),
  title: z.string(),
  stillUrl: z.string().nullish(),
  overview: z.string().nullish(),
});

/**
 * One season of a series, as a catalogue describes it.
 *
 * `episodes` carries what each one is called and what it looks like, so an
 * episode nobody holds can still be read about: a viewer meeting a gap wants
 * to know which episode it is, not that a number is absent. Empty where the
 * catalogue was asked only how many there are.
 */
const SeasonShapeSchema = z.object({
  seasonNumber: z.number().int().nonnegative(),
  episodeCount: z.number().int().nonnegative(),
  episodes: z.array(CatalogueEpisodeSchema).default([]),
});

/**
 * Everything the library holds about a series, and what it ought to hold.
 *
 * `shape` is absent when nothing can say: no catalogue is configured, the
 * series was never matched to one, or it could not be reached. Absent means
 * unknown rather than complete, and nothing downstream may read it as a
 * series being whole.
 */
const ShowDetailSchema = ShowSummarySchema.extend({
  seasons: z.array(ShowSeasonSchema),
  shape: z.array(SeasonShapeSchema).nullish(),
});

const ShowListSchema = z.object({ shows: z.array(ShowSummarySchema) });

type CatalogueEpisode = z.infer<typeof CatalogueEpisodeSchema>;
type SeasonShape = z.infer<typeof SeasonShapeSchema>;
type ShowSummary = z.infer<typeof ShowSummarySchema>;
type ShowSeason = z.infer<typeof ShowSeasonSchema>;
type ShowDetail = z.infer<typeof ShowDetailSchema>;

export type { CatalogueEpisode, SeasonShape, ShowDetail, ShowSeason, ShowSummary };

export { ShowSummarySchema, ShowSeasonSchema, SeasonShapeSchema, ShowDetailSchema, ShowListSchema };
