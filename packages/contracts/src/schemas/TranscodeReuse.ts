import { z } from 'zod';

const TRANSCODE_REUSES = ['none', 'partial', 'whole', 'shared'] as const;

const TranscodeReuseSchema = z.enum(TRANSCODE_REUSES);

type TranscodeReuse = z.infer<typeof TranscodeReuseSchema>;

export type { TranscodeReuse };

export { TranscodeReuseSchema, TRANSCODE_REUSES };
