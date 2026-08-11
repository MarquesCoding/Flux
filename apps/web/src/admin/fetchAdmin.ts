import { z } from 'zod';
import { PlaybackPlanSchema } from '@FluxContracts/schemas/PlaybackPlan';
import { ScanJobSchema } from '@FluxWeb/library/fetchLibrary';
import type { ScanJob } from '@FluxWeb/library/fetchLibrary';

const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  createdAt: z.string(),
});

const AdminOverviewSchema = z.object({
  users: z.array(AdminUserSchema),
  settings: z.object({
    hasCatalogueKey: z.boolean(),
    trustedOrigins: z.array(z.string()),
    cookieSecure: z.boolean(),
  }),
  transcoder: z.object({
    isReachable: z.boolean(),
    ffmpegVersion: z.string().nullable(),
    hardwareAccels: z.array(z.string()),
  }),
  library: z.object({
    itemCount: z.number(),
    libraryCount: z.number(),
  }),
});

const JobSchema = z.object({
  id: z.number(),
  kind: z.string(),
  subject: z.string(),
  state: z.enum(['queued', 'running', 'finished', 'failed']),
  queuedAtMs: z.number(),
  startedAtMs: z.number().nullable(),
  finishedAtMs: z.number().nullable(),
  detail: z.string().nullable(),
});

const ProcessUseSchema = z.object({
  pid: z.number(),
  cpuPercent: z.number(),
  memoryBytes: z.number(),
});

const MonitorSchema = z.object({
  resources: z.object({
    atMs: z.number(),
    systemCpuPercent: z.number(),
    systemMemoryUsedBytes: z.number(),
    systemMemoryTotalBytes: z.number(),
    cpuCount: z.number(),
    serviceCpuPercent: z.number(),
    serviceMemoryBytes: z.number(),
    children: z.array(ProcessUseSchema),
    loadAverage: z.number(),
  }),
  queue: z.object({
    concurrency: z.number(),
    queued: z.number(),
    running: z.number(),
    jobs: z.array(JobSchema),
  }),
  sessions: z.number(),
  logs: z.array(
    z.object({
      atMs: z.number(),
      level: z.enum(['info', 'warn', 'error']),
      source: z.string(),
      message: z.string(),
    }),
  ),
});

const ActiveSessionSchema = z.object({
  clientId: z.string(),
  profileId: z.string().nullable(),
  profileName: z.string().nullable(),
  deviceLabel: z.string(),
  connectedAt: z.number(),
  playback: z
    .object({
      mediaId: z.string(),
      mediaTitle: z.string(),
      hasPoster: z.boolean(),
      hasBackdrop: z.boolean(),
      mode: z.enum(['direct', 'transcode']),
      plan: PlaybackPlanSchema,
      isPlaying: z.boolean(),
      pausedByAdmin: z.boolean(),
      startedAt: z.number(),
      health: z
        .object({
          positionSeconds: z.number(),
          durationSeconds: z.number(),
          bufferedAheadSeconds: z.number(),
          presentedWidth: z.number(),
          presentedHeight: z.number(),
        })
        .nullable(),
    })
    .nullable(),
});

/**
 * A job an admin can start on demand, as the Work tab's picker sees it.
 */
const JobDefinitionSchema = z.object({
  kind: z.string(),
  label: z.string(),
  description: z.string(),
  needsLibrary: z.boolean(),
  destructive: z.boolean(),
});

/**
 * What makes a job run on its own, matching the server's own set of triggers
 * — see `apps/server/src/jobs/scheduleTrigger.ts`.
 */
const ScheduleTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('startup') }),
  z.object({
    kind: z.literal('everyMinutes'),
    minutes: z.number().int().min(1).max(59),
  }),
  z.object({
    kind: z.literal('everyHours'),
    hours: z.number().int().min(1).max(23),
  }),
  z.object({
    kind: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('weekly'),
    dayOfWeek: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
]);

const JobTriggerSchema = z.object({
  id: z.string(),
  trigger: ScheduleTriggerSchema,
});

const JobScheduleSchema = z.object({
  kind: z.string(),
  triggers: z.array(JobTriggerSchema),
});

type AdminOverview = z.infer<typeof AdminOverviewSchema>;
type Monitor = z.infer<typeof MonitorSchema>;
type Job = z.infer<typeof JobSchema>;
type ActiveSession = z.infer<typeof ActiveSessionSchema>;
type JobDefinition = z.infer<typeof JobDefinitionSchema>;
type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>;
type JobTrigger = z.infer<typeof JobTriggerSchema>;
type JobSchedule = z.infer<typeof JobScheduleSchema>;

/**
 * Reads the state of the server.
 */
/**
 * Why the server could not be read, or nothing when it could.
 *
 * Reported rather than thrown. A page that cannot say what is wrong sends
 * somebody to the terminal to find out, and the answer is usually already in
 * the response it just threw away.
 */
type OverviewOutcome = { overview: AdminOverview | null; problem: string | null };

const fetchAdminOverview = async (): Promise<OverviewOutcome> => {
  const response = await fetch('/api/admin/overview', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null) {
    return { overview: null, problem: 'The server could not be reached.' };
  }

  if (!response.ok) {
    return {
      overview: null,
      problem: `The server answered ${response.status.toString()}.`,
    };
  }

  const parsed = AdminOverviewSchema.safeParse(await response.json().catch(() => null));

  return parsed.success
    ? { overview: parsed.data, problem: null }
    : {
        overview: null,
        problem: `The server answered something this page did not understand: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
      };
};

/**
 * Reads one measurement of what the media service is doing.
 *
 * Used for the first paint, before the stream has had time to say anything.
 * A page that opens empty and fills in a second later reads as broken.
 */
const fetchMonitor = async (): Promise<Monitor | null> => {
  const response = await fetch('/api/admin/monitor', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return null;
  }

  return MonitorSchema.parse(await response.json());
};

/**
 * Watches the media service, calling back on every reading.
 *
 * Returns the function that stops watching. Server-sent events rather than
 * polling: the service already knows when it has something new to say, and a
 * page asking every second whether anything happened is a page that costs
 * something even when nothing does.
 */
const watchMonitor = (onReading: (reading: Monitor) => void): (() => void) => {
  const source = new EventSource('/api/admin/monitor/stream', { withCredentials: true });

  source.onmessage = (event: MessageEvent<string>) => {
    const parsed = MonitorSchema.safeParse(JSON.parse(event.data));

    if (parsed.success) {
      onReading(parsed.data);
    }
  };

  return () => {
    source.close();
  };
};

/**
 * Reads every tab that has the app open right now.
 */
const fetchActiveSessions = async (): Promise<ActiveSession[]> => {
  const response = await fetch('/api/admin/sessions', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  return z.array(ActiveSessionSchema).parse(await response.json());
};

/**
 * Stops someone else's stream, kicking them out of the player.
 */
const stopSession = async (clientId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/sessions/${clientId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Pauses someone else's stream. Not a lock — they can press play again.
 */
const pauseSession = async (clientId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/sessions/${clientId}/pause`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Resumes a stream this admin paused.
 */
const resumeSession = async (clientId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/sessions/${clientId}/resume`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Reads every job an admin can start on demand from the Work tab.
 */
const fetchJobDefinitions = async (): Promise<JobDefinition[]> => {
  const response = await fetch('/api/admin/jobs/definitions', {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return [];
  }

  const { definitions } = z
    .object({ definitions: z.array(JobDefinitionSchema) })
    .parse(await response.json());

  return definitions;
};

/**
 * Starts a job of the given kind against a library, from the Work tab.
 *
 * Additive to the per-library `scanLibrary`/`resetLibrary`/
 * `regenerateLibraryPreviews` calls in `fetchLibrary.ts` rather than a
 * replacement for them — this is the admin-gated, kind-generic entry point
 * the job picker needs, working for any kind the server's job registry
 * returns without further changes here.
 */
const runJob = async (
  kind: string,
  libraryId?: string,
  force?: boolean,
): Promise<ScanJob | null> => {
  const response = await fetch(`/api/admin/jobs/${kind}/run`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...(libraryId === undefined ? {} : { libraryId }),
      ...(force === undefined ? {} : { force }),
    }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Reads what makes each job run on its own.
 */
const fetchJobSchedules = async (): Promise<JobSchedule[]> => {
  const response = await fetch('/api/admin/jobs/schedules', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  const { schedules } = z
    .object({ schedules: z.array(JobScheduleSchema) })
    .parse(await response.json());

  return schedules;
};

/**
 * Adds one trigger to a job, reporting it with the id that removes it again.
 */
const addJobTrigger = async (
  kind: string,
  trigger: ScheduleTrigger,
): Promise<JobTrigger | null> => {
  const response = await fetch(`/api/admin/jobs/${kind}/triggers`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trigger }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return JobTriggerSchema.parse(await response.json());
};

/**
 * Removes one trigger from a job.
 */
const removeJobTrigger = async (kind: string, triggerId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/jobs/${kind}/triggers/${triggerId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Saves a setting an operator owns.
 */
const saveCatalogueKey = async (catalogueApiKey: string): Promise<boolean> => {
  const response = await fetch('/api/admin/settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogueApiKey }),
  }).catch(() => null);

  return response !== null && response.ok;
};

export type {
  OverviewOutcome,
  ActiveSession,
  AdminOverview,
  Job,
  JobDefinition,
  JobSchedule,
  JobTrigger,
  Monitor,
  ScheduleTrigger,
};

export {
  fetchAdminOverview,
  fetchMonitor,
  watchMonitor,
  saveCatalogueKey,
  fetchActiveSessions,
  stopSession,
  pauseSession,
  resumeSession,
  fetchJobDefinitions,
  runJob,
  fetchJobSchedules,
  addJobTrigger,
  removeJobTrigger,
};
