import { z } from 'zod';

/**
 * One thing somebody watched, once.
 *
 * `secondsWatched` is how long was actually spent rather than how long the
 * thing is, so a film abandoned after ten minutes reads as ten minutes.
 *
 * The names are nullable because an item can leave the library after it was
 * watched. The viewing outlives it — somebody did watch it — and a history
 * that quietly dropped those rows would be lying about the evening.
 */
const ViewingSchema = z.object({
  id: z.string(),
  mediaItemId: z.string(),
  title: z.string().nullable(),
  seriesTitle: z.string().nullable(),
  startedAt: z.string(),
  lastWatchedAt: z.string(),
  secondsWatched: z.number(),
  isFinished: z.boolean(),
});

const ViewingListSchema = z.object({ viewings: z.array(ViewingSchema) });

const ForgottenSchema = z.object({ forgotten: z.number() });

type Viewing = z.infer<typeof ViewingSchema>;

export { ViewingSchema, ViewingListSchema, ForgottenSchema };

export type { Viewing };
