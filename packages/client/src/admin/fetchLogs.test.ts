import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLogs, watchLogs } from './fetchLogs';
import type { LogRecord } from '@FluxContracts/schemas/Log';
import type { RealtimeEvent } from '@FluxContracts/schemas/Realtime';

const fetchMock = vi.fn();

const said = (body: object, ok = true) => ({ ok, json: () => Promise.resolve(body) });

const A_RECORD: LogRecord = {
  id: 'one',
  atMs: 0,
  level: 'info',
  source: 'server',
  message: 'Something happened',
  detail: null,
  count: 1,
  context: {
    jobId: null,
    jobKind: null,
    libraryId: null,
    mediaId: null,
    sessionId: null,
    requestId: null,
  },
};

const NOTHING = { records: [], total: 0 };

const anEvent = (payload: object): RealtimeEvent => ({
  kind: 'event',
  topic: 'logs',
  atMs: 0,
  folded: 0,
  payload: { ...payload },
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLogs', () => {
  it('asks the server for what matched', async () => {
    fetchMock.mockResolvedValue(said({ records: [A_RECORD], total: 1 }));

    await expect(fetchLogs({ levels: ['info'] })).resolves.toEqual({
      records: [A_RECORD],
      total: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/logs',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ levels: ['info'] }) }),
    );
  });

  it('says the log is empty rather than taking the page down with it', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchLogs({})).resolves.toEqual(NOTHING);

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchLogs({})).resolves.toEqual(NOTHING);
  });

  it('says the log is empty when the answer is not one', async () => {
    fetchMock.mockResolvedValue(said({ records: 'lots' }));

    await expect(fetchLogs({})).resolves.toEqual(NOTHING);
  });
});

describe('watchLogs', () => {
  it('follows the log over the connection the rest of the application already has', () => {
    const told = vi.fn();
    let listen = (event: RealtimeEvent): void => {
      expect(event).toBeDefined();
    };

    const stop = vi.fn();

    const client = {
      subscribe: (topic: string, listener: (event: RealtimeEvent) => void) => {
        expect(topic).toBe('logs');
        listen = listener;

        return stop;
      },
    };

    const stopped = watchLogs(told, client);

    listen(anEvent(A_RECORD));

    expect(told).toHaveBeenCalledWith(A_RECORD);

    stopped();

    expect(stop).toHaveBeenCalled();
  });

  it('ignores anything on the topic that is not a record', () => {
    const told = vi.fn();
    let listen = (event: RealtimeEvent): void => {
      expect(event).toBeDefined();
    };

    watchLogs(told, {
      subscribe: (_topic: string, listener: (event: RealtimeEvent) => void) => {
        listen = listener;

        return () => undefined;
      },
    });

    listen(anEvent({ nonsense: true }));

    expect(told).not.toHaveBeenCalled();
  });
});
