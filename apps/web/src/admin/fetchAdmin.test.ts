import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import { fetchAdminOverview, fetchMonitor, watchMonitor, saveCatalogueKey } from './fetchAdmin';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { Monitor } from './fetchAdmin';

type Answer = { ok: boolean; json: () => Promise<JsonValue> };

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
  },
  transcoder: { isReachable: true, ffmpegVersion: '9.0', hardwareAccels: ['videotoolbox'] },
  library: { itemCount: 15, libraryCount: 2 },
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
  },
  queue: { concurrency: 2, queued: 1, running: 1, jobs: [] },
  sessions: 0,
  logs: [{ atMs: 1, level: 'info', source: 'transcoder', message: 'Started' }],
};

/**
 * The body of the last request, as it was sent.
 */
const sentBody = (): JsonValue => {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;

  return JsonValueSchema.parse(JSON.parse(typeof body === 'string' ? body : 'null'));
};

const answerWith = (body: JsonValue, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: () => Promise.resolve(body) });
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

  it('says nothing when the server refuses, since only an admin may ask', async () => {
    answerWith({}, false);

    await expect(fetchAdminOverview()).resolves.toBeNull();
  });

  it('says nothing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchAdminOverview()).resolves.toBeNull();
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

describe('watchMonitor', () => {
  class FakeEventSource {
    static last: FakeEventSource | null = null;

    onmessage: ((event: MessageEvent<string>) => void) | null = null;

    isClosed = false;

    constructor(readonly url: string) {
      FakeEventSource.last = this;
    }

    close() {
      this.isClosed = true;
    }
  }

  beforeEach(() => {
    FakeEventSource.last = null;
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  it('listens rather than asking every second whether anything happened', () => {
    watchMonitor(vi.fn());

    expect(FakeEventSource.last?.url).toBe('/api/admin/monitor/stream');
  });

  it('reports every reading', () => {
    const onReading = vi.fn();

    watchMonitor(onReading);
    FakeEventSource.last?.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify(MONITOR) }),
    );

    expect(onReading).toHaveBeenCalledWith(MONITOR);
  });

  it('ignores a reading it cannot read, rather than throwing on a stream', () => {
    const onReading = vi.fn();

    watchMonitor(onReading);
    FakeEventSource.last?.onmessage?.(new MessageEvent('message', { data: '{"queue":"busy"}' }));

    expect(onReading).not.toHaveBeenCalled();
  });

  it('stops watching when it is told to', () => {
    const stop = watchMonitor(vi.fn());

    stop();

    expect(FakeEventSource.last?.isClosed).toBe(true);
  });
});
