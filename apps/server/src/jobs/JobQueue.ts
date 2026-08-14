import { z } from 'zod';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

/**
 * The jobs Flux runs in the background.
 *
 * Scanning is the reason this exists: walking and probing a real library takes
 * minutes, and doing it inline means an HTTP request that times out while the
 * work carries on invisibly. See ADR-0005.
 */
const SCAN_LIBRARY_JOB = 'library.scan';

/**
 * Reads a few named files again, after somebody said what they are.
 *
 * Not a `library.scan` with a short list, because a scan deletes what it did
 * not find and this listing is deliberately a handful of the library. Its own
 * kind also means a correction appears in Activity as what it is rather than
 * as a scan nobody started.
 */
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

/**
 * Re-renders preview clips for a library's already-scanned media, without a
 * full rescan.
 *
 * A separate job from `library.scan` on purpose: changing a library's forced
 * audio language should not re-probe every file, re-run metadata providers
 * and re-sample colours just to pick up a different audio track in the
 * previews.
 */
const REGENERATE_PREVIEWS_JOB = 'library.regeneratePreviews';

const RegeneratePreviewsJobSchema = z.object({
  libraryId: z.string().uuid(),
  defaultAudioLanguage: z.string().nullable(),
});

type RegeneratePreviewsJob = z.infer<typeof RegeneratePreviewsJobSchema>;

/**
 * Prunes viewing history older than the horizon.
 *
 * The log grows for ever otherwise: one row per profile per thing watched per
 * sitting, and a household adds to it every evening. What is worth keeping is
 * recent enough to be read.
 */
const PRUNE_HISTORY_JOB = 'library.pruneHistory';

const PruneHistoryJobSchema = z.object({});

type PruneHistoryJob = z.infer<typeof PruneHistoryJobSchema>;

/**
 * Collects the lettering each title is written in.
 *
 * Separate from `library.scan` because it asks a catalogue rather than the
 * filesystem, and because a library scanned before Flux knew about logos
 * should be able to gain them without re-probing every file it holds.
 */
const FETCH_LOGOS_JOB = 'library.fetchLogos';

const FetchLogosJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type FetchLogosJob = z.infer<typeof FetchLogosJobSchema>;

/**
 * Re-renders every scrubbing thumbnail sheet for a library's already-scanned
 * media, without a full rescan.
 *
 * Separate from `library.regeneratePreviews` on purpose — a tile sheet and a
 * scrub clip are different renders with different reasons to redo them, and
 * an admin picking one from the Work tab should not have to run the other.
 */
const REGENERATE_TRICKPLAY_JOB = 'library.regenerateTrickplay';

const RegenerateTrickplayJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type RegenerateTrickplayJob = z.infer<typeof RegenerateTrickplayJobSchema>;

/**
 * Finds intros, outros and other skippable segments across a library's
 * already-scanned media, without a full rescan.
 *
 * An ordinary scan already runs this once for whatever it just imported —
 * this is for redoing it on demand, such as after a segment provider was
 * reconfigured.
 */
const DETECT_SEGMENTS_JOB = 'library.detectSegments';

const DetectSegmentsJobSchema = z.object({
  libraryId: z.string().uuid(),
});

type DetectSegmentsJob = z.infer<typeof DetectSegmentsJobSchema>;

/**
 * Deletes cached artwork and profile photo files nothing in the database
 * references any more.
 *
 * Not library-scoped — the cache is one directory shared by every library,
 * and a profile photo belongs to an account, not a library.
 */
const CLEANUP_IMAGE_CACHE_JOB = 'server.cleanupImageCache';

/**
 * Deletes preview clips and thumbnail sheets nothing in any library addresses.
 *
 * Not library-scoped, and cannot be: the cache is one flat directory of
 * addresses shared by every library, so a sweep told about one of them would
 * find every other library's artefacts unaddressed and delete them.
 */
const CLEANUP_ARTEFACT_CACHE_JOB = 'server.cleanupArtefactCache';

/**
 * Clears out expired sign-in sessions and device-authorization codes.
 *
 * Not library-scoped — sessions and device codes belong to accounts, not
 * libraries.
 */
const CLEANUP_SESSIONS_JOB = 'server.cleanupSessions';

/**
 * Verifies the configured catalogue key can actually reach the catalogue.
 *
 * Not library-scoped — one key serves every library's metadata matching.
 */
const CHECK_CATALOGUE_CONNECTIVITY_JOB = 'server.checkCatalogueConnectivity';

/**
 * Asks the transcoder whether it is still there.
 *
 * The health route already answers this question, but only when somebody
 * asks it. Nothing was watching, so a transcoder that had gone unresponsive
 * stayed unnoticed until the next person pressed play — which is the way
 * round it has actually gone wrong more than once.
 *
 * Not library-scoped: one transcoder serves every library.
 */
const CHECK_TRANSCODER_JOB = 'server.checkTranscoder';

/**
 * Sends one event to one subscriber.
 *
 * A job rather than a call made where the event was raised, which is the
 * whole reason the event bus does not deliver: this can be retried with
 * backoff, it can fail without taking down the scan that caused it, and it
 * is visible in the Work tab like everything else.
 *
 * One job per subscriber rather than one per event, so a receiver that is
 * down does not hold up delivery to a receiver that is not.
 *
 * The queue's retry settings are right for this as they stand — two attempts
 * with backoff, then it gives up. The two-hour expiry sized for scans never
 * comes into it, because a delivery abandons its request after ten seconds
 * long before the queue would wonder whether the job is still alive.
 */
const DELIVER_WEBHOOK_JOB = 'webhook.deliver';

/**
 * Which subscriber, and the envelope as a string exactly as it will be
 * signed.
 */
const DeliverWebhookJobSchema = z.object({
  subscriptionId: z.string().uuid(),
  payload: z.string().min(1),
});

type DeliverWebhookJob = z.infer<typeof DeliverWebhookJobSchema>;

/**
 * The queue a schedule for a library-scoped kind actually fires on.
 *
 * A schedule cannot target `library.scan` itself — pg-boss sends the same
 * fixed payload every time it fires, and a library-scoped job needs a
 * `libraryId` decided at the moment it runs, against whatever libraries
 * exist then, not whatever existed when the schedule was set. This queue's
 * handler is the thing that actually enumerates libraries and enqueues the
 * real job once per library — see `Main.ts`.
 */
const scheduleTriggerKind = (kind: string): string => `${kind}.scheduled`;

/**
 * Where a queued job has got to.
 */
const JobStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown']);

type JobState = z.infer<typeof JobStateSchema>;

/**
 * How far a running job has got.
 *
 * `phase` names what it is doing right now — a job with more than one kind
 * of work reports a fresh `processed`/`total` for each, rather than one
 * number that has to somehow mean both.
 */
type JobProgress = {
  phase: string;
  processed: number;
  total: number;
};

/**
 * The queue as the rest of the server sees it.
 *
 * A port rather than pg-boss directly, so the routes can be tested without
 * Postgres and so the queue can be swapped without touching call sites.
 */
/**
 * A job in flight, named by what it is about.
 *
 * `subject` is what the work concerns — a library id, for everything that
 * runs against one — so a page can match a running job to the thing on screen
 * without having been the one to start it.
 */
type RunningJob = {
  jobId: string;
  kind: string;
  subject: string | null;
  progress: JobProgress | null;
};

type JobQueue = {
  /**
   * Queues work of the given kind, reporting its job id.
   *
   * Null means one is already queued under the same `singletonKey`. `kind`
   * must be one registered as a handler when the queue was created — see
   * `createJobQueue`.
   */
  enqueue: (
    kind: string,
    payload: { [key: string]: JsonValue },
    singletonKey?: string,
  ) => Promise<string | null>;
  readState: (jobId: string) => Promise<JobState>;
  /**
   * What a running job last reported about itself.
   *
   * Null until the job has reported anything, which is also true of a job
   * that does not report progress at all.
   */
  readProgress: (jobId: string) => JobProgress | null;
  reportProgress: (jobId: string, phase: string, processed: number, total: number) => void;
  /**
   * Every job the server is working on right now, and what each is about.
   *
   * A browser that asked for a scan knows its job id until it is reloaded, and
   * then knows nothing: the work carries on and the page that started it has
   * no way to find it again. Asking the server what is running is the only
   * answer that survives a refresh, or a second browser, or being opened by
   * somebody else entirely.
   */
  listRunning: () => RunningJob[];
  /**
   * Asks a job to stop, reporting whether there was one to ask.
   *
   * A job that has not started yet is dropped and never runs. A job already
   * running is asked rather than killed: the work is a loop over files, and
   * stopping between two of them leaves the library consistent, where killing
   * it partway through one would leave a row half written. What that costs is
   * time — a job in the middle of a slow probe finishes that probe first.
   *
   * False means there was nothing to stop, which covers both a job id that
   * was never real and one that finished while somebody was reaching for the
   * menu.
   */
  cancel: (jobId: string) => Promise<boolean>;
  /**
   * Whether this job has been asked to stop.
   *
   * Read by the work itself, between items. A job that never asks cannot be
   * stopped partway and will run to its end, which is correct for work too
   * short to be worth interrupting.
   */
  isCancelled: (jobId: string) => boolean;
  /**
   * Sets one of the schedules a queue name runs on.
   *
   * Keyed rather than one-per-queue because a job may have several triggers —
   * nightly and hourly are two schedules on the same queue, told apart by
   * their key. `queueName` must be one registered as a handler, the same as
   * `enqueue` — a schedule fires by sending to that queue.
   */
  setSchedule: (queueName: string, key: string, cron: string) => Promise<void>;
  clearSchedule: (queueName: string, key: string) => Promise<void>;
  /**
   * Every schedule currently set, across every queue name.
   */
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
  DELIVER_WEBHOOK_JOB,
  DeliverWebhookJobSchema,
  scheduleTriggerKind,
  JobStateSchema,
};
