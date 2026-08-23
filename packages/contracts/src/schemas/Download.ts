import { z } from 'zod';
import { QualityStepIdSchema } from '@ValenceContracts/schemas/QualityStep';

const DOWNLOAD_STATES = ['queued', 'preparing', 'paused', 'ready', 'failed'] as const;

const DownloadStateSchema = z.enum(DOWNLOAD_STATES);

const DownloadQualitySchema = z.union([z.literal('original'), QualityStepIdSchema]);

const DownloadSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  seriesId: z.string().nullable(),
  seriesTitle: z.string().nullable(),
  title: z.string(),
  quality: DownloadQualitySchema,
  audioLanguages: z.array(z.string()),
  state: DownloadStateSchema,
  progress: z.number().min(0).max(1),
  sizeBytes: z.number().int().nonnegative().nullable(),
  failure: z.string().nullable(),
  askedAt: z.string().datetime(),
  readyAt: z.string().datetime().nullable(),
});

const DownloadListSchema = z.object({ downloads: z.array(DownloadSchema) });

const DownloadRequestSchema = z.object({
  mediaId: z.string().uuid(),
  quality: DownloadQualitySchema,
  audioLanguages: z.array(z.string()).default([]),
});

const HoldingSchema = z.object({
  mediaId: z.string().uuid(),
  quality: DownloadQualitySchema,
  heldAt: z.string().datetime(),
});

const HoldingListSchema = z.object({ holdings: z.array(HoldingSchema) });

type DownloadState = z.infer<typeof DownloadStateSchema>;
type DownloadQuality = z.infer<typeof DownloadQualitySchema>;
type Download = z.infer<typeof DownloadSchema>;
type DownloadRequest = z.infer<typeof DownloadRequestSchema>;
type Holding = z.infer<typeof HoldingSchema>;

export type { Download, DownloadQuality, DownloadRequest, DownloadState, Holding };

export {
  DOWNLOAD_STATES,
  DownloadListSchema,
  DownloadQualitySchema,
  DownloadRequestSchema,
  DownloadSchema,
  DownloadStateSchema,
  HoldingListSchema,
  HoldingSchema,
};
