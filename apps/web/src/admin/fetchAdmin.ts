import { z } from 'zod';

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

type AdminOverview = z.infer<typeof AdminOverviewSchema>;
type Monitor = z.infer<typeof MonitorSchema>;
type Job = z.infer<typeof JobSchema>;

/**
 * Reads the state of the server.
 */
const fetchAdminOverview = async (): Promise<AdminOverview | null> => {
  const response = await fetch('/api/admin/overview', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return null;
  }

  return AdminOverviewSchema.parse(await response.json());
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
    // Parsed through the schema like every other body: an event stream is
    // still input, and this one arrives without even a status code to check.
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

export type { AdminOverview, Job, Monitor };

export { fetchAdminOverview, fetchMonitor, watchMonitor, saveCatalogueKey };
