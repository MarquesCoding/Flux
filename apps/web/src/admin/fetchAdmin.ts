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
    hardwareAccel: z.string().default(''),
  }),
  transcoder: z.object({
    isReachable: z.boolean(),
    address: z.string(),
    ffmpegVersion: z.string().nullable(),
    ffmpegSupported: z.boolean().default(true),
    hardwareAccels: z.array(z.string()),
    rejectedEncoders: z.array(z.object({ encoder: z.string(), reason: z.string() })).default([]),
  }),
  library: z.object({
    itemCount: z.number(),
    libraryCount: z.number(),
    bytes: z.number().default(0),
  }),
  artwork: z
    .object({ count: z.number(), bytes: z.number(), atMs: z.number() })
    .nullable()
    .default(null),
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

const DiskUseSchema = z.object({
  mountPoint: z.string(),
  totalBytes: z.number(),
  availableBytes: z.number(),
});

const ArtefactUseSchema = z.object({
  count: z.number(),
  bytes: z.number(),
});

const GraphicsUseSchema = z.object({
  name: z.string(),
  encoderPercent: z.number().nullable(),
  devicePercent: z.number().nullable(),
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
    disks: z.array(DiskUseSchema).default([]),
    graphics: GraphicsUseSchema.nullable().default(null),
  }),
  cache: z
    .object({
      previews: ArtefactUseSchema,
      trickplay: ArtefactUseSchema,
      sessions: ArtefactUseSchema,
      atMs: z.number(),
    })
    .nullable()
    .default(null),
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

const JobDefinitionSchema = z.object({
  kind: z.string(),
  label: z.string(),
  description: z.string(),
  needsLibrary: z.boolean(),
  destructive: z.boolean(),
});

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

const RunningScansSchema = z.object({
  scans: z.array(
    z.object({
      jobId: z.string(),
      kind: z.string(),
      libraryId: z.string().nullable(),
      phase: z.string().nullable(),
      processed: z.number().nullable(),
      total: z.number().nullable(),
    }),
  ),
});

type RunningScan = z.infer<typeof RunningScansSchema>['scans'][number];

/**
 * What the server is working on right now.
 */
const fetchRunningScans = async (): Promise<RunningScan[]> => {
  const response = await fetch('/api/libraries/scans', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  const parsed = RunningScansSchema.safeParse(await response.json().catch(() => null));

  return parsed.success ? parsed.data.scans : [];
};

const CatalogueMatchesSchema = z.object({
  matches: z.array(
    z.object({
      externalId: z.string(),
      kind: z.enum(['tv', 'movie']),
      title: z.string(),
      year: z.number().nullable(),
      overview: z.string().nullable(),
      posterUrl: z.string().nullable(),
    }),
  ),
});

type CatalogueMatch = z.infer<typeof CatalogueMatchesSchema>['matches'][number];

/**
 * Asks the catalogue what it holds under a name, for the dialog where an operator corrects what a
 * file is.
 *
 * @param query - What to search for.
 * @param kind - Whether to look for films or programmes.
 * @returns What the catalogue offered.
 */
const searchCatalogue = async (query: string, kind: 'tv' | 'movie'): Promise<CatalogueMatch[]> => {
  const parameters = new URLSearchParams({ query, kind });
  const response = await fetch(`/api/admin/catalogue/search?${parameters.toString()}`, {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return [];
  }

  const parsed = CatalogueMatchesSchema.safeParse(await response.json().catch(() => null));

  return parsed.success ? parsed.data.matches : [];
};

/**
 * Reads the state of the server.
 */
const fetchAdminOverview = async (): Promise<AdminOverview> => {
  const response = await fetch('/api/admin/overview', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null) {
    throw new Error('The server could not be reached.');
  }

  if (!response.ok) {
    throw new Error(`The server answered ${response.status.toString()}.`);
  }

  return AdminOverviewSchema.parse(await response.json());
};

/**
 * Reads one measurement of what the media service is doing.
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
 * Follows what the media service is doing — sessions, encoders, disk — calling back on every reading
 * rather than being asked, since an operator watching a graph notices anything slower than a second.
 *
 * @param onReading - Told each reading as it arrives.
 * @returns The function that stops watching.
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
 * Follows who has the application open and what they are watching, as it changes, for the sessions
 * page an operator leaves open.
 *
 * @param onSessions - Told the sessions whenever they change.
 * @returns The function that stops watching.
 */
const watchActiveSessions = (onSessions: (sessions: ActiveSession[]) => void): (() => void) => {
  const source = new EventSource('/api/admin/sessions/stream', { withCredentials: true });

  source.onmessage = (event: MessageEvent<string>) => {
    const parsed = z.array(ActiveSessionSchema).safeParse(JSON.parse(event.data));

    if (parsed.success) {
      onSessions(parsed.data);
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
 * Stops somebody else's stream, which closes their player rather than pausing it — for the case
 * where a session has to end rather than wait.
 *
 * @param clientId - The session to stop.
 */
const stopSession = async (clientId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/sessions/${clientId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Pauses somebody else's stream. Not a lock: they can press play again, and it is meant as a way to
 * get somebody's attention rather than to take the film away.
 *
 * @param clientId - The session to pause.
 */
const pauseSession = async (clientId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/sessions/${clientId}/pause`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Resumes a stream an operator paused.
 *
 * @param clientId - The session to resume.
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
 * Starts a job by hand — a scan, a sweep, a rebuild — against one library or against the server as a
 * whole, and answers with the job so the page can watch it.
 *
 * @param kind - Which job.
 * @param libraryId - Which library, for the kinds that take one.
 * @param force - Whether to redo work already done.
 * @returns The job to watch, or why it was refused.
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
 * Asks a running job to stop. A job that has not started is dropped; one that is running is asked,
 * and stops at the next point it can.
 *
 * @param jobId - The job to stop.
 */
const cancelJob = async (jobId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/jobs/running/${jobId}/cancel`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
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
 * Adds one trigger to a job's schedule, answering with the identifier that removes it again, so the
 * page can offer that without reloading everything.
 *
 * @param kind - Which job.
 * @param trigger - The schedule to add.
 * @returns The trigger as stored.
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
 * Removes one trigger from a job's schedule.
 *
 * @param kind - Which job.
 * @param triggerId - The trigger to remove.
 */
const removeJobTrigger = async (kind: string, triggerId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/jobs/${kind}/triggers/${triggerId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

const StorageCountSchema = z.object({
  cache: z
    .object({
      previews: ArtefactUseSchema,
      trickplay: ArtefactUseSchema,
      sessions: ArtefactUseSchema,
      atMs: z.number(),
    })
    .nullable(),
  artwork: z.object({ count: z.number(), bytes: z.number(), atMs: z.number() }).nullable(),
  libraryBytes: z.number(),
});

type StorageCount = z.infer<typeof StorageCountSchema>;

/**
 * Asks both services to count their caches now.
 */
const measureStorage = async (): Promise<StorageCount | null> => {
  const response = await fetch('/api/admin/storage/measure', { method: 'POST' }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  const parsed = StorageCountSchema.safeParse(await response.json().catch(() => null));

  return parsed.success ? parsed.data : null;
};

/**
 * Sets which encoder transcodes should use, or leaves it to Flux. Takes effect on the next session
 * rather than on the ones already running, which keep the encoder they started with.
 *
 * @param hardwareAccel - The encoder to force, or an empty string for automatic.
 * @returns Whether the setting was written.
 */
const saveHardwareAccel = async (hardwareAccel: string): Promise<boolean> => {
  const response = await fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hardwareAccel }),
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Sets the key Flux reads metadata with. Without one, titles, artwork and years come from filenames
 * alone.
 *
 * @param catalogueApiKey - The key to use.
 * @returns Whether it was written.
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
  CatalogueMatch,
  ActiveSession,
  AdminOverview,
  Job,
  JobDefinition,
  JobSchedule,
  JobTrigger,
  Monitor,
  ScheduleTrigger,
  StorageCount,
};

export {
  fetchAdminOverview,
  fetchRunningScans,
  searchCatalogue,
  fetchMonitor,
  watchMonitor,
  saveCatalogueKey,
  saveHardwareAccel,
  fetchActiveSessions,
  watchActiveSessions,
  stopSession,
  pauseSession,
  resumeSession,
  fetchJobDefinitions,
  runJob,
  cancelJob,
  fetchJobSchedules,
  addJobTrigger,
  removeJobTrigger,
  measureStorage,
};
