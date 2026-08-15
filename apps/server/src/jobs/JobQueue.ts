import { z } from 'zod';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const SCAN_LIBRARY_JOB = 'library.scan';

const READ_AGAIN_JOB = 'library.readAgain';

const ReadAgainJobSchema = z.object({
  libraryId: z.string().uuid(),
  paths: z.array(z.string().min(1)).min(1),
});

type ReadAgainJob = z.infer<typeof ReadAgainJobSchema>;

const ScanLibraryJobSchema = z.object({
  libraryId: z.string().uuid(),
  force: z.boolean().default(false),
});

type ScanLibraryJob = z.infer<typeof ScanLibraryJobSchema>;

const REGENERATE_PREVIEWS_JOB = 'library.regeneratePreviews';

const RegeneratePreviewsJobSchema = z.object({
  libraryId: z.string().uuid(),
  defaultAudioLanguage: z.string().nullable(),
});

type RegeneratePreviewsJob = z.infer<typeof RegeneratePreviewsJobSchema>;

const PRUNE_HISTORY_JOB = 'library.pruneHistory';

const PruneHistoryJobSchema = z.object({});

type PruneHistoryJob = z.infer<typeof PruneHistoryJobSchema>;

const FETCH_LOGOS_JOB = 'library.fetchLogos';

const FetchLogosJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type FetchLogosJob = z.infer<typeof FetchLogosJobSchema>;

const REGENERATE_TRICKPLAY_JOB = 'library.regenerateTrickplay';

const RegenerateTrickplayJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type RegenerateTrickplayJob = z.infer<typeof RegenerateTrickplayJobSchema>;

const DETECT_SEGMENTS_JOB = 'library.detectSegments';

const DetectSegmentsJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type DetectSegmentsJob = z.infer<typeof DetectSegmentsJobSchema>;

const CLEANUP_IMAGE_CACHE_JOB = 'server.cleanupImageCache';

const CLEANUP_ARTEFACT_CACHE_JOB = 'server.cleanupArtefactCache';

const CLEANUP_SESSIONS_JOB = 'server.cleanupSessions';

const CHECK_CATALOGUE_CONNECTIVITY_JOB = 'server.checkCatalogueConnectivity';

const CHECK_TRANSCODER_JOB = 'server.checkTranscoder';

const CHECK_DISK_SPACE_JOB = 'server.checkDiskSpace';

const SEND_MEDIA_DIGEST_JOB = 'server.sendMediaDigest';

const DELIVER_WEBHOOK_JOB = 'webhook.deliver';

const DeliverWebhookJobSchema = z.object({
  subscriptionId: z.string().uuid(),
  payload: z.string().min(1),
});

type DeliverWebhookJob = z.infer<typeof DeliverWebhookJobSchema>;

const PRUNE_WEBHOOK_DELIVERIES_JOB = 'server.pruneWebhookDeliveries';

/**
 * The queue a schedule for a library-scoped kind actually fires on.
 */
const scheduleTriggerKind = (kind: string): string => `${kind}.scheduled`;

const JobStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown']);

type JobState = z.infer<typeof JobStateSchema>;

type JobProgress = {
  phase: string;
  processed: number;
  total: number;
};

type RunningJob = {
  jobId: string;
  kind: string;
  subject: string | null;
  progress: JobProgress | null;
};

type JobQueue = {
  enqueue: (
    kind: string,
    payload: { [key: string]: JsonValue },
    singletonKey?: string,
  ) => Promise<string | null>;
  readState: (jobId: string) => Promise<JobState>;
  readProgress: (jobId: string) => JobProgress | null;
  reportProgress: (jobId: string, phase: string, processed: number, total: number) => void;
  listRunning: () => RunningJob[];
  cancel: (jobId: string) => Promise<boolean>;
  isCancelled: (jobId: string) => boolean;
  setSchedule: (queueName: string, key: string, cron: string) => Promise<void>;
  clearSchedule: (queueName: string, key: string) => Promise<void>;
  listSchedules: () => Promise<{ queueName: string; key: string; cron: string }[]>;
  stop: () => Promise<void>;
};

export type {
  DeliverWebhookJob,
  DetectSegmentsJob,
  JobProgress,
  JobQueue,
  JobState,
  RegeneratePreviewsJob,
  ReadAgainJob,
  RegenerateTrickplayJob,
  FetchLogosJob,
  PruneHistoryJob,
  RunningJob,
  ScanLibraryJob,
};

export {
  SCAN_LIBRARY_JOB,
  ScanLibraryJobSchema,
  READ_AGAIN_JOB,
  ReadAgainJobSchema,
  REGENERATE_PREVIEWS_JOB,
  RegeneratePreviewsJobSchema,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  PRUNE_HISTORY_JOB,
  RegenerateTrickplayJobSchema,
  FetchLogosJobSchema,
  PruneHistoryJobSchema,
  DETECT_SEGMENTS_JOB,
  DetectSegmentsJobSchema,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
  CHECK_TRANSCODER_JOB,
  CHECK_DISK_SPACE_JOB,
  SEND_MEDIA_DIGEST_JOB,
  DELIVER_WEBHOOK_JOB,
  PRUNE_WEBHOOK_DELIVERIES_JOB,
  DeliverWebhookJobSchema,
  scheduleTriggerKind,
  JobStateSchema,
};
