import { z } from 'zod';
import {
  SCAN_LIBRARY_JOB,
  REGENERATE_PREVIEWS_JOB,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  PRUNE_HISTORY_JOB,
  DETECT_SEGMENTS_JOB,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
  CHECK_TRANSCODER_JOB,
  CHECK_DISK_SPACE_JOB,
  SEND_MEDIA_DIGEST_JOB,
  PRUNE_WEBHOOK_DELIVERIES_JOB,
  PRUNE_LOGS_JOB,
  scheduleTriggerKind,
} from './JobQueue';
import type { ScheduleTrigger } from './scheduleTrigger';

const RESET_LIBRARY_JOB = 'library.reset';

type JobDefinition = {
  kind: string;
  label: string;
  description: string;
  needsLibrary: boolean;
  destructive: boolean;
};

const JOB_DEFINITIONS: JobDefinition[] = [
  {
    kind: SCAN_LIBRARY_JOB,
    label: 'Scan for changes',
    description:
      'Finds new, changed and removed files, then makes whatever they are still missing.',
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
      'Deletes every item in every library and starts again from nothing: scanning, then everything each item needs made for it. Hours of work on a large library.',
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
    kind: PRUNE_HISTORY_JOB,
    label: 'Prune old viewing history',
    description:
      'Forgets viewings older than a year. What each profile has watched recently stays; the rest is removed, because this log grows every evening and nobody reads back that far.',
    needsLibrary: false,
    destructive: true,
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
  {
    kind: CHECK_TRANSCODER_JOB,
    label: 'Check the transcoder',
    description:
      'Asks the transcoder whether it is still answering, so an operator hears about it going quiet from a notification rather than from somebody pressing play.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: CHECK_DISK_SPACE_JOB,
    label: 'Check disk space',
    description:
      'Asks how much room is left on the filesystems Valence writes to, so a disk about to fill is something an operator hears about rather than something a scan discovers.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: SEND_MEDIA_DIGEST_JOB,
    label: 'Tell the household about new media',
    description:
      'Collects what has been imported since the last time and says it once, so a scan of four hundred files is one notification rather than four hundred.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: PRUNE_LOGS_JOB,
    label: 'Prune old log records',
    description:
      'Forgets log records past the age their level is kept for, so errors outlive the ordinary chatter. A retention policy nobody enforces is a table that grows until the disk fills.',
    needsLibrary: false,
    destructive: false,
  },
  {
    kind: PRUNE_WEBHOOK_DELIVERIES_JOB,
    label: 'Prune old webhook deliveries',
    description:
      'Forgets what was sent to webhook subscribers more than a week ago. Recent deliveries stay, so a receiver that has started failing is still visible; the rest goes, because this table gains a row for every event sent to everybody.',
    needsLibrary: false,
    destructive: false,
  },
];

const DEFAULT_JOB_TRIGGERS: Record<string, ScheduleTrigger[]> = {
  [SCAN_LIBRARY_JOB]: [{ kind: 'daily', hour: 3, minute: 0 }],
  [REGENERATE_PREVIEWS_JOB]: [{ kind: 'daily', hour: 3, minute: 30 }],
  [REGENERATE_TRICKPLAY_JOB]: [{ kind: 'daily', hour: 4, minute: 0 }],
  [DETECT_SEGMENTS_JOB]: [{ kind: 'daily', hour: 4, minute: 30 }],
  [CHECK_CATALOGUE_CONNECTIVITY_JOB]: [{ kind: 'daily', hour: 5, minute: 0 }],
  [CHECK_TRANSCODER_JOB]: [{ kind: 'everyMinutes', minutes: 5 }],
  [CHECK_DISK_SPACE_JOB]: [{ kind: 'everyMinutes', minutes: 15 }],
  [SEND_MEDIA_DIGEST_JOB]: [{ kind: 'everyHours', hours: 1 }],
  [CLEANUP_SESSIONS_JOB]: [{ kind: 'daily', hour: 5, minute: 30 }],
  [PRUNE_WEBHOOK_DELIVERIES_JOB]: [{ kind: 'daily', hour: 5, minute: 45 }],
  [PRUNE_LOGS_JOB]: [{ kind: 'daily', hour: 5, minute: 55 }],
  [CLEANUP_IMAGE_CACHE_JOB]: [{ kind: 'weekly', dayOfWeek: 0, hour: 6, minute: 0 }],
  [CLEANUP_ARTEFACT_CACHE_JOB]: [{ kind: 'weekly', dayOfWeek: 0, hour: 6, minute: 30 }],
};

/**
 * Names the queue a kind's schedule fires on. A library-scoped job runs once per library, so its
 * schedule cannot fire on the job's own queue — it fires on a queue of its own, whose worker fans it
 * out across every library that exists at the time.
 *
 * @param kind - The kind of job being scheduled.
 * @returns The queue its schedule should fire on.
 */
const scheduleQueueNameFor = (kind: string): string => {
  const definition = JOB_DEFINITIONS.find((candidate) => candidate.kind === kind);

  return definition?.needsLibrary === true ? scheduleTriggerKind(kind) : kind;
};

const JobRunRequestSchema = z.object({
  libraryId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

export type { JobDefinition };

export {
  JOB_DEFINITIONS,
  DEFAULT_JOB_TRIGGERS,
  JobRunRequestSchema,
  RESET_LIBRARY_JOB,
  scheduleQueueNameFor,
};
