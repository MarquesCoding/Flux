import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { RealtimeEvent, RealtimeTopic } from '@FluxContracts/schemas/Realtime';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';
import {
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
  fetchRunningScans,
  searchCatalogue,
  cancelJob,
  saveHardwareAccel,
} from './fetchAdmin';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { Monitor } from './fetchAdmin';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

type Answer = { ok: boolean; status: number; json: () => Promise<JsonValue> };

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>;

const fetchMock = vi.fn<FetchLike>();

const OVERVIEW = {
  users: [
    {
      id: 'abc',
      name: 'Marques',
      email: 'marques@flux.local',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  settings: {
    hasCatalogueKey: true,
    trustedOrigins: ['http://localhost:5173'],
    cookieSecure: false,
    hardwareAccel: '',
  },
  transcoder: {
    isReachable: true,
    address: 'unix:/tmp/flux-transcoder.sock',
    ffmpegVersion: '9.0',
    ffmpegSupported: true,
    hardwareAccels: ['videotoolbox'],
    rejectedEncoders: [],
  },
  library: { itemCount: 15, libraryCount: 2, bytes: 0 },
  artwork: null,
};

const MONITOR: Monitor = {
  resources: {
    atMs: 1,
    systemCpuPercent: 12,
    systemMemoryUsedBytes: 8,
    systemMemoryTotalBytes: 16,
    cpuCount: 10,
    serviceCpuPercent: 3,
    serviceMemoryBytes: 4,
    children: [{ pid: 42, cpuPercent: 90, memoryBytes: 100 }],
    loadAverage: 1.5,
    disks: [],
    graphics: null,
  },
  queue: { concurrency: 2, queued: 1, running: 1, jobs: [] },
  sessions: 0,
  logs: [{ atMs: 1, level: 'info', source: 'transcoder', message: 'Started' }],
  cache: null,
};

/**
 * The body of the last request, as it was sent.
 */
const sentBody = (): JsonValue => {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;

  return JsonValueSchema.parse(JSON.parse(typeof body === 'string' ? body : 'null'));
};

const answerWith = (body: JsonValue, ok = true) => {
  fetchMock.mockResolvedValue({
    ok,
    status: ok ? 200 : 403,
    json: () => Promise.resolve(body),
  });
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAdminOverview', () => {
  it('reads the state of the server', async () => {
    answerWith(OVERVIEW);

    await expect(fetchAdminOverview()).resolves.toEqual(OVERVIEW);
  });

  it('says which answer it got when the server refuses', async () => {
    answerWith({}, false);

    await expect(fetchAdminOverview()).rejects.toThrow('answered');
  });

  it('says so when the server cannot be reached at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchAdminOverview()).rejects.toThrow('could not be reached');
  });

  it('refuses an answer it does not understand rather than reading past it', async () => {
    answerWith({ ...OVERVIEW, transcoder: { isReachable: 'yes' } });

    await expect(fetchAdminOverview()).rejects.toThrow();
  });
});

describe('fetchMonitor', () => {
  it('takes one reading, so the page does not open empty', async () => {
    answerWith(MONITOR);

    await expect(fetchMonitor()).resolves.toEqual(MONITOR);
  });

  it('says nothing when the media service has nothing to say', async () => {
    answerWith({}, false);

    await expect(fetchMonitor()).resolves.toBeNull();
  });

  it('says nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchMonitor()).resolves.toBeNull();
  });
});

describe('saveCatalogueKey', () => {
  it('saves the key an operator owns', async () => {
    answerWith({});

    await saveCatalogueKey('a-key');

    expect(sentBody()).toEqual({ catalogueApiKey: 'a-key' });
  });

  it('reports failure rather than pretending it saved', async () => {
    answerWith({}, false);

    await expect(saveCatalogueKey('a-key')).resolves.toBe(false);
  });

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(saveCatalogueKey('a-key')).resolves.toBe(false);
  });
});

describe('fetchActiveSessions', () => {
  const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };
  const plan: PlaybackPlan = {
    mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    container: { kind: 'passthrough', reason },
    video: { kind: 'passthrough', reason },
    audio: { kind: 'passthrough', streamIndex: 1, reason },
    subtitles: { kind: 'none', reason },
  };

  const SESSION = {
    clientId: 'tab-1',
    profileId: 'profile-1',
    profileName: 'Dan',
    deviceLabel: 'Living room TV',
    connectedAt: 1000,
    playback: {
      mediaId: 'media-1',
      mediaTitle: 'Arrival',
      hasPoster: true,
      hasBackdrop: true,
      mode: 'direct' as const,
      plan,
      isPlaying: true,
      pausedByAdmin: false,
      startedAt: 1500,
      health: null,
    },
  };

  it('reads every tab that has the app open', async () => {
    answerWith([SESSION]);

    await expect(fetchActiveSessions()).resolves.toEqual([SESSION]);
  });

  it('reports nothing when the server refuses, rather than throwing', async () => {
    answerWith([], false);

    await expect(fetchActiveSessions()).resolves.toEqual([]);
  });

  it('reports nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchActiveSessions()).resolves.toEqual([]);
  });
});

describe('stopSession', () => {
  it('stops the stream an admin picked', async () => {
    answerWith({});

    await expect(stopSession('tab-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sessions/tab-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reports failure rather than pretending it stopped', async () => {
    answerWith({}, false);

    await expect(stopSession('tab-1')).resolves.toBe(false);
  });

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(stopSession('tab-1')).resolves.toBe(false);
  });
});

describe('pauseSession', () => {
  it('pauses the stream an admin picked', async () => {
    answerWith({});

    await expect(pauseSession('tab-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sessions/tab-1/pause',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports failure rather than pretending it paused', async () => {
    answerWith({}, false);

    await expect(pauseSession('tab-1')).resolves.toBe(false);
  });
});

describe('resumeSession', () => {
  it('resumes a stream this admin paused', async () => {
    answerWith({});

    await expect(resumeSession('tab-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sessions/tab-1/resume',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports failure rather than pretending it resumed', async () => {
    answerWith({}, false);

    await expect(resumeSession('tab-1')).resolves.toBe(false);
  });
});

describe('fetchJobDefinitions', () => {
  const DEFINITIONS = [
    {
      kind: 'library.scan',
      label: 'Scan for changes',
      description: 'Finds new, changed and removed files.',
      needsLibrary: true,
      destructive: false,
    },
    {
      kind: 'library.reset',
      label: 'Reset and rebuild',
      description: 'Deletes everything in the library, then scans it from nothing.',
      needsLibrary: true,
      destructive: true,
    },
  ];

  it('reads every job an admin can start', async () => {
    answerWith({ definitions: DEFINITIONS });

    await expect(fetchJobDefinitions()).resolves.toEqual(DEFINITIONS);
  });

  it('reports nothing when the server refuses', async () => {
    answerWith({}, false);

    await expect(fetchJobDefinitions()).resolves.toEqual([]);
  });

  it('reports nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchJobDefinitions()).resolves.toEqual([]);
  });
});

describe('runJob', () => {
  it('starts the job an admin picked, against the library they chose', async () => {
    answerWith({ jobId: 'job-1', state: 'queued' });

    await expect(runJob('library.scan', 'lib-1', true)).resolves.toEqual({
      jobId: 'job-1',
      state: 'queued',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/jobs/library.scan/run',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sentBody()).toEqual({ libraryId: 'lib-1', force: true });
  });

  it('leaves force out of the body when the caller does not pass one', async () => {
    answerWith({ jobId: 'job-1', state: 'queued' });

    await runJob('library.regeneratePreviews', 'lib-1');

    expect(sentBody()).toEqual({ libraryId: 'lib-1' });
  });

  it('leaves libraryId out of the body for a job that does not need one', async () => {
    answerWith({ jobId: 'job-1', state: 'queued' });

    await runJob('server.cleanupImageCache');

    expect(sentBody()).toEqual({});
  });

  it('reports nothing when the server refuses', async () => {
    answerWith({}, false);

    await expect(runJob('library.scan', 'lib-1')).resolves.toBeNull();
  });

  it('reports nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(runJob('library.scan', 'lib-1')).resolves.toBeNull();
  });
});

describe('fetchJobSchedules', () => {
  const SCHEDULES = [
    {
      kind: 'library.scan',
      triggers: [
        { id: 'trigger-1', trigger: { kind: 'everyHours', hours: 6 } },
        { id: 'trigger-2', trigger: { kind: 'startup' } },
      ],
    },
    { kind: 'library.reset', triggers: [] },
  ];

  it('reads what makes each job run on its own', async () => {
    answerWith({ schedules: SCHEDULES });

    await expect(fetchJobSchedules()).resolves.toEqual(SCHEDULES);
  });

  it('reports nothing when the server refuses', async () => {
    answerWith({}, false);

    await expect(fetchJobSchedules()).resolves.toEqual([]);
  });

  it('reports nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchJobSchedules()).resolves.toEqual([]);
  });
});

describe('addJobTrigger', () => {
  it('adds a trigger to the job an admin picked', async () => {
    answerWith({ id: 'trigger-1', trigger: { kind: 'daily', hour: 3, minute: 0 } });

    await expect(
      addJobTrigger('library.scan', { kind: 'daily', hour: 3, minute: 0 }),
    ).resolves.toEqual({ id: 'trigger-1', trigger: { kind: 'daily', hour: 3, minute: 0 } });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/jobs/library.scan/triggers',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sentBody()).toEqual({ trigger: { kind: 'daily', hour: 3, minute: 0 } });
  });

  it('reports nothing rather than pretending it saved', async () => {
    answerWith({}, false);

    await expect(addJobTrigger('library.scan', { kind: 'startup' })).resolves.toBeNull();
  });

  it('reports nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(addJobTrigger('library.scan', { kind: 'startup' })).resolves.toBeNull();
  });
});

describe('removeJobTrigger', () => {
  it('removes the trigger by its id', async () => {
    answerWith({});

    await expect(removeJobTrigger('library.scan', 'trigger-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/jobs/library.scan/triggers/trigger-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reports failure rather than pretending it removed', async () => {
    answerWith({}, false);

    await expect(removeJobTrigger('library.scan', 'trigger-1')).resolves.toBe(false);
  });

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(removeJobTrigger('library.scan', 'trigger-1')).resolves.toBe(false);
  });
});

describe('watchMonitor', () => {
  const createFakeClient = () => {
    const listeners = new Map<RealtimeTopic, (event: RealtimeEvent) => void>();

    const client: RealtimeClient = {
      start: () => {},
      stop: () => {},
      subscribe: (topic, listen) => {
        listeners.set(topic, listen);

        return () => {
          listeners.delete(topic);
        };
      },
      identify: () => {},
      onResumed: () => () => {},
      isLive: () => true,
    };

    return {
      client,
      watching: () => [...listeners.keys()],
      arrive: (payload: JsonValue) => {
        listeners.get('monitor')?.({
          kind: 'event',
          topic: 'monitor',
          atMs: 1,
          folded: 0,
          payload,
        });
      },
    };
  };

  it('listens on the one connection rather than opening a stream of its own', () => {
    const fake = createFakeClient();

    watchMonitor(vi.fn(), fake.client);

    expect(fake.watching()).toStrictEqual(['monitor']);
  });

  it('reports every reading', () => {
    const fake = createFakeClient();
    const onReading = vi.fn();

    watchMonitor(onReading, fake.client);
    fake.arrive(JsonValueSchema.parse(JSON.parse(JSON.stringify(MONITOR))));

    expect(onReading).toHaveBeenCalledWith(MONITOR);
  });

  it('ignores a reading it cannot read, rather than throwing', () => {
    const fake = createFakeClient();
    const onReading = vi.fn();

    watchMonitor(onReading, fake.client);
    fake.arrive({ queue: 'busy' });

    expect(onReading).not.toHaveBeenCalled();
  });

  it('stops watching when it is told to', () => {
    const fake = createFakeClient();

    const stop = watchMonitor(vi.fn(), fake.client);

    stop();

    expect(fake.watching()).toStrictEqual([]);
  });
});

describe('what the server is working on', () => {
  it('reads the scans that are running', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          scans: [
            {
              jobId: 'job-1',
              kind: 'library.scan',
              libraryId: 'lib-1',
              phase: 'probing',
              processed: 3,
              total: 10,
            },
          ],
        }),
    });

    await expect(fetchRunningScans()).resolves.toMatchObject([{ jobId: 'job-1' }]);
  });

  it('says nothing is running when the server refuses to say', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve(null) });

    await expect(fetchRunningScans()).resolves.toEqual([]);
  });

  it('says nothing is running when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchRunningScans()).resolves.toEqual([]);
  });

  it('says nothing is running when the answer is not one it recognises', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nope: 1 }),
    });

    await expect(fetchRunningScans()).resolves.toEqual([]);
  });
});

describe('asking the catalogue what it holds under a name', () => {
  const MATCH = {
    externalId: '329',
    kind: 'movie' as const,
    title: 'Arrival',
    year: 2016,
    overview: null,
    posterUrl: null,
  };

  it('passes the name and the kind on, and answers with what came back', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ matches: [MATCH] }),
    });

    await expect(searchCatalogue('Arrival', 'movie')).resolves.toEqual([MATCH]);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('query=Arrival&kind=movie');
  });

  it('offers nothing when the server refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve(null) });

    await expect(searchCatalogue('Arrival', 'movie')).resolves.toEqual([]);
  });

  it('offers nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(searchCatalogue('Arrival', 'movie')).resolves.toEqual([]);
  });

  it('offers nothing when the answer is not one it recognises', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nope: 1 }),
    });

    await expect(searchCatalogue('Arrival', 'movie')).resolves.toEqual([]);
  });
});

describe('stopping a job and choosing a backend', () => {
  it('asks the server to stop one, by the id it is running under', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202, json: () => Promise.resolve({}) });

    await expect(cancelJob('job-1')).resolves.toBe(true);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('/api/admin/jobs/running/job-1/cancel');
  });

  it('reports a job there was nothing to stop', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) });

    await expect(cancelJob('job-1')).resolves.toBe(false);
  });

  it('reports a server it could not reach to stop anything', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(cancelJob('job-1')).resolves.toBe(false);
  });

  it('sends the backend an operator insisted on', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });

    await expect(saveHardwareAccel('nvenc')).resolves.toBe(true);

    const [, init] = fetchMock.mock.calls.at(-1) ?? [];

    expect(init?.body).toContain('nvenc');
  });

  it('reports a backend the server would not take', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(saveHardwareAccel('nvenc')).resolves.toBe(false);
  });
});
