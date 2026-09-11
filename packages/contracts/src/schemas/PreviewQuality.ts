import { z } from 'zod';

const PREVIEW_QUALITIES = ['low', 'standard', 'high'] as const;

const PreviewQualitySchema = z.enum(PREVIEW_QUALITIES);

type PreviewQuality = z.infer<typeof PreviewQualitySchema>;

export type { PreviewQuality };

export { PREVIEW_QUALITIES, PreviewQualitySchema };
