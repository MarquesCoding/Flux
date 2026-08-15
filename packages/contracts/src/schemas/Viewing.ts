import { z } from 'zod';

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
