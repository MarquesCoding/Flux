import { z } from 'zod';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

const SCAN_LIBRARY_JOB = 'library.scan';

const READ_AGAIN_JOB = 'library.readAgain';

const ReadAgainJobSchema = z.object({
  libraryId: z.string().uuid(),
  paths: z.array(z.string().min(1)).min(1),
});

const ScanLibraryJobSchema = z.object({
  libraryId: z.string().uuid(),
  force: z.boolean().default(false),
  runId: z.string().min(1).optional(),
  runOf: z.number().int().positive().optional(),
});

const REGENERATE_PREVIEWS_JOB = 'library.regeneratePreviews';

const RegeneratePreviewsJobSchema = z.object({
  libraryId: z.string().uuid(),
  defaultAudioLanguage: z.string().nullable(),
});

const PRUNE_HISTORY_JOB = 'library.pruneHistory';

const FETCH_LOGOS_JOB = 'library.fetchLogos';

const FetchLogosJobSchema = z.object({
  libraryId: z.string().uuid(),
});

const REGENERATE_TRICKPLAY_JOB = 'library.regenerateTrickplay';

const RegenerateTrickplayJobSchema = z.object({
  libraryId: z.string().uuid(),
});

const DETECT_SEGMENTS_JOB = 'library.detectSegments';

const DetectSegmentsJobSchema = z.object({
  libraryId: z.string().uuid(),
});

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

const PRUNE_WEBHOOK_DELIVERIES_JOB = 'server.pruneWebhookDeliveries';

const PRUNE_LOGS_JOB = 'server.pruneLogs';

/**
 * Names the queue a library-scoped kind's schedule fires on, which is a queue of its own rather than
 * the job's, since one schedule has to fan out across every library.
 *
 * @param kind - The kind of job.
 * @returns The name of the queue its schedule fires on.
 */
const scheduleTriggerKind = (kind: string): string => `${kind}.scheduled`;

type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'unknown';

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
  startWorking: () => Promise<void>;
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
  cancelFor: (subject: string) => Promise<number>;
  isCancelled: (jobId: string) => boolean;
  setSchedule: (queueName: string, key: string, cron: string, timezone: string) => Promise<void>;
  clearSchedule: (queueName: string, key: string) => Promise<void>;
  listSchedules: () => Promise<
    { queueName: string; key: string; cron: string; timezone: string }[]
  >;
  stop: () => Promise<void>;
};

export type { JobProgress, JobQueue, JobState, RunningJob };

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
  PRUNE_LOGS_JOB,
  DeliverWebhookJobSchema,
  scheduleTriggerKind,
};
