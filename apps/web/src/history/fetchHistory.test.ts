import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHistory, forgetViewing, forgetHistory } from './fetchHistory';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

const refused = { ok: false, status: 401, json: () => Promise.resolve(null) };

const watched = {
  viewings: [
    {
      id: 'viewing-1',
      mediaItemId: '9c858901-8a57-4791-81fe-4c455b099bc9',
      title: 'Arrival',
      seriesTitle: null,
      startedAt: '2026-08-10T20:00:00.000Z',
      lastWatchedAt: '2026-08-10T22:00:00.000Z',
      secondsWatched: 7_200,
      isFinished: true,
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading a history', () => {
  it('answers with what was watched', async () => {
    fetchMock.mockResolvedValue(ok(watched));

    await expect(fetchHistory()).resolves.toHaveLength(1);
  });

  it('asks for the page it was asked for', async () => {
    fetchMock.mockResolvedValue(ok(watched));

    await fetchHistory(60);

    expect(fetchMock.mock.calls[0]?.[0]).toContain('offset=60');
  });

  it('answers with nothing rather than throwing when the server refuses', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(fetchHistory()).resolves.toEqual([]);
  });

  it('answers with nothing rather than throwing when the network is gone', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchHistory()).resolves.toEqual([]);
  });

  it('answers with nothing rather than throwing when the body is not a history', async () => {
    fetchMock.mockResolvedValue(ok({ nonsense: true }));

    await expect(fetchHistory()).resolves.toEqual([]);
  });
});

describe('forgetting one viewing', () => {
  it('says it worked when the server says so', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) });

    await expect(forgetViewing('viewing-1')).resolves.toBe(true);
  });

  it('says it did not when there is no such viewing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(forgetViewing('viewing-1')).resolves.toBe(false);
  });

  it('says it did not rather than throwing when the network is gone', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(forgetViewing('viewing-1')).resolves.toBe(false);
  });
});

describe('forgetting the lot', () => {
  it('answers with how much was forgotten', async () => {
    fetchMock.mockResolvedValue(ok({ forgotten: 12 }));

    await expect(forgetHistory()).resolves.toBe(12);
  });

  it('answers with none rather than throwing when the server refuses', async () => {
    fetchMock.mockResolvedValue(refused);

    await expect(forgetHistory()).resolves.toBe(0);
  });

  it('answers with none rather than throwing when the network is gone', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(forgetHistory()).resolves.toBe(0);
  });
});
