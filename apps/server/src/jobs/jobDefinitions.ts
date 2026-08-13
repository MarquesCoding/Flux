import { z } from 'zod';
import {
  SCAN_LIBRARY_JOB,
  REGENERATE_PREVIEWS_JOB,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  DETECT_SEGMENTS_JOB,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
  scheduleTriggerKind,
} from './JobQueue';
import type { ScheduleTrigger } from './scheduleTrigger';

/**
 * Not a pg-boss job kind of its own — `LibraryService.reset` clears a
 * library's rows and then enqueues a `library.scan`, the same as an
 * ordinary forced scan. Listed here anyway because an admin picking a job
 * to run does not think in queue kinds; they think "reset this library",
 * and that is its own distinct, destructive action worth its own entry.
 */
const RESET_LIBRARY_JOB = 'library.reset';

/**
 * A job an admin can start on demand from the Work tab.
 *
 * The registry an admin picker renders from, kept separate from the queue
 * itself so a picker never needs to know a pg-boss kind string — it lists
 * `JOB_DEFINITIONS` and asks the admin route to run one by `kind`.
 */
type JobDefinition = {
  kind: string;
  label: string;
  description: string;
  /**
   * Whether this job runs against every library rather than the server as
   * a whole.
   *
   * Every library-scoped job here always runs against every library —
   * picking one library to run against is what the Libraries panel's own
   * buttons are for. The picker groups by this rather than assuming it, so
   * a future server-wide job (a catalogue-wide re-match, say) lists
   * separately from these instead of needing a library nobody would pick
   * for it.
   */
  needsLibrary: boolean;
  /**
   * Whether running this loses data that cannot be recovered.
   *
   * The picker asks before running one of these rather than treating every
   * job the same — a scan only ever adds to or corrects what a library
   * already has, but a reset deletes it all first.
   */
  destructive: boolean;
};

const JOB_DEFINITIONS: JobDefinition[] = [
  {
    kind: SCAN_LIBRARY_JOB,
    label: 'Scan for changes',
    description:
      'Finds new, changed and removed files, then makes whatever they are still missing — previews, scrub previews and intros.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: REGENERATE_PREVIEWS_JOB,
    label: 'Generate missing previews',
    description:
      "Renders preview clips for items that have none, using each library's forced audio language. Skips items that already have one.",
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: REGENERATE_TRICKPLAY_JOB,
    label: 'Generate missing scrub previews',
    description:
      'Renders the strip of images shown when scrubbing the seek bar, for items that have none. Skips items that already have one.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: FETCH_LOGOS_JOB,
    label: 'Fetch missing logos',
    description:
      "Collects the lettering each title is written in, so a hero shows the programme's own logo rather than its name set in the interface's typeface. Skips items that already have one, and items no catalogue has named.",
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: DETECT_SEGMENTS_JOB,
    label: 'Detect missing intros and outros',
    description:
      'Finds the intro and the recap in each episode by comparing the audio across a season, so viewers can skip them. Skips seasons already done.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: RESET_LIBRARY_JOB,
    label: 'Reset and rebuild',
    description:
      'Deletes every item in every library and starts again from nothing: scanning, then previews, scrub previews and intro detection for the lot. Hours of work on a large library.',
    needsLibrary: true,
    destructive: true,
  },
  {
    kind: CLEANUP_IMAGE_CACHE_JOB,
    label: 'Clean up cached images',
    description: 'Removes cached artwork and profile photos nothing references any more.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: CLEANUP_ARTEFACT_CACHE_JOB,
    label: 'Clean up cached previews',
    description:
      'Removes preview clips and scrub previews nothing addresses any more, freeing the space left behind by a reset or a change to how they are made.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: CLEANUP_SESSIONS_JOB,
    label: 'Clean up sessions',
    description: 'Clears out expired sign-in sessions and device-authorization codes.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: CHECK_CATALOGUE_CONNECTIVITY_JOB,
    label: 'Check catalogue connectivity',
    description: 'Verifies the configured catalogue key can actually reach the catalogue.',
    needsLibrary: false,
    destructive: false,
  },
];

/**
 * What each job runs on out of the box.
 *
 * Kept out of `JobDefinition` because it is not part of what a job *is* — the
 * picker never shows it — only what a fresh instance starts with. A kind
 * absent from here has no default and runs only when asked.
 *
 * Nothing destructive is here. Everything else can be, now that each job
 * works from what is outstanding rather than redoing a whole library: a
 * nightly run over a library with nothing new costs a query and stops. The
 * scan already runs previews, scrub previews and detection itself, so their own
 * schedules are the catch-up pass — what a failed render or an ffmpeg that
 * was down at 03:00 gets picked up by.
 *
 * Staggered through the small hours so a server does not try to do all of it
 * at once, and in the order the work depends on: nothing to render until the
 * scan has found it.
 */
const DEFAULT_JOB_TRIGGERS: Record<string, ScheduleTrigger[]> = {
  [SCAN_LIBRARY_JOB]: [{ kind: 'daily', hour: 3, minute: 0 }],
  [REGENERATE_PREVIEWS_JOB]: [{ kind: 'daily', hour: 3, minute: 30 }],
  [REGENERATE_TRICKPLAY_JOB]: [{ kind: 'daily', hour: 4, minute: 0 }],
  [DETECT_SEGMENTS_JOB]: [{ kind: 'daily', hour: 4, minute: 30 }],
  [CHECK_CATALOGUE_CONNECTIVITY_JOB]: [{ kind: 'daily', hour: 5, minute: 0 }],
  [CLEANUP_SESSIONS_JOB]: [{ kind: 'daily', hour: 5, minute: 30 }],
  [CLEANUP_IMAGE_CACHE_JOB]: [{ kind: 'weekly', dayOfWeek: 0, hour: 6, minute: 0 }],
  [CLEANUP_ARTEFACT_CACHE_JOB]: [{ kind: 'weekly', dayOfWeek: 0, hour: 6, minute: 30 }],
};

/**
 * Which queue a kind's schedule actually fires on.
 *
 * A library-scoped kind fires on its trigger queue — see
 * `scheduleTriggerKind` — since the real kind's queue expects a payload
 * naming a library, and a schedule has none to give it. A server-wide kind
 * has no such indirection: it fires on its own queue.
 */
const scheduleQueueNameFor = (kind: string): string => {
  const definition = JOB_DEFINITIONS.find((candidate) => candidate.kind === kind);

  return definition?.needsLibrary === true ? scheduleTriggerKind(kind) : kind;
};

const JobRunRequestSchema = z.object({
  libraryId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

type JobRunRequest = z.infer<typeof JobRunRequestSchema>;

export type { JobDefinition, JobRunRequest };

export {
  JOB_DEFINITIONS,
  DEFAULT_JOB_TRIGGERS,
  JobRunRequestSchema,
  RESET_LIBRARY_JOB,
  scheduleQueueNameFor,
};
