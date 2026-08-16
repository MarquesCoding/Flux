import { z } from 'zod';
import { MediaSummarySchema } from './Library';

const ShowSummarySchema = z.object({
  id: z.string().min(1),
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  seasonCount: z.number().int().nonnegative(),
  episodeCount: z.number().int().nonnegative(),
  latestAddedAt: z.string(),
  coverMediaId: z.string().uuid(),
  seriesId: z.string().uuid().nullable().default(null),
  year: z.number().int().nullish(),
  rating: z.number().nullish(),
  genres: z.array(z.string()).nullish(),
});

const ShowSeasonSchema = z.object({
  seasonNumber: z.number().int().nullable(),
  episodes: z.array(MediaSummarySchema),
});

const CatalogueEpisodeSchema = z.object({
  episodeNumber: z.number().int().positive(),
  title: z.string(),
  stillUrl: z.string().nullish(),
  overview: z.string().nullish(),
});

const SeasonShapeSchema = z.object({
  seasonNumber: z.number().int().nonnegative(),
  episodeCount: z.number().int().nonnegative(),
  episodes: z.array(CatalogueEpisodeSchema).default([]),
});

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
