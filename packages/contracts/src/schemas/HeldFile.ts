import { z } from 'zod';
import { DownloadQualitySchema } from '@ValenceContracts/schemas/Download';

const HELD_STATES = ['fetching', 'paused', 'here', 'failed'] as const;

const HeldStateSchema = z.enum(HELD_STATES);

const WhatToKeepSchema = z.object({
  downloadId: z.string().uuid(),
  mediaId: z.string().uuid(),
  seriesId: z.string().nullable().default(null),
  seriesTitle: z.string().nullable().default(null),
  title: z.string().min(1),
  quality: DownloadQualitySchema,
  durationSeconds: z.number().positive().nullable().default(null),
  ofBytes: z.number().int().nonnegative().nullable().default(null),
});

const HeldFileSchema = WhatToKeepSchema.extend({
  state: HeldStateSchema,
  bytes: z.number().int().nonnegative(),
  bytesPerSecond: z.number().int().nonnegative().nullable().default(null),
  failure: z.string().nullable().default(null),
  keptAt: z.string().datetime(),
  hasPoster: z.boolean().default(false),
});

const HeldFileListSchema = z.object({ held: z.array(HeldFileSchema) });

type HeldState = z.infer<typeof HeldStateSchema>;
type WhatToKeep = z.infer<typeof WhatToKeepSchema>;
type HeldFile = z.infer<typeof HeldFileSchema>;

export type { HeldFile, HeldState, WhatToKeep };

export { HELD_STATES, HeldFileListSchema, HeldFileSchema, HeldStateSchema, WhatToKeepSchema };
