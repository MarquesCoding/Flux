import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { fetchWatchProgress, reportWatchProgress, byMediaId } from './watchProgress';
import { writeCurrentProfile } from '@FluxWeb/profiles/currentProfile';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

type Answer = { ok: boolean; json: () => Promise<JsonValue>; text?: () => Promise<string> };

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>;

const fetchMock = vi.fn<FetchLike>();

/**
 * The body of the last request, as it was sent.
 */
const sentBody = (): JsonValue => {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;

  return JsonValueSchema.parse(JSON.parse(typeof body === 'string' ? body : 'null'));
};

const PROGRESS: WatchProgress = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  positionSeconds: 600,
  durationSeconds: 7200,
  isFinished: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ progress: [PROGRESS] }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWatchProgress', () => {
  it('reads where this viewer got to', async () => {
    await expect(fetchWatchProgress()).resolves.toEqual([PROGRESS]);
  });

  it('says who is watching, so a household does not share a place in a film', async () => {
    writeCurrentProfile('abc');

    await fetchWatchProgress();

    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ 'x-flux-profile': 'abc' });
  });

  it('says it could not ask when the server refuses, rather than throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(fetchWatchProgress()).resolves.toBeNull();
  });

  it('says it could not ask when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchWatchProgress()).resolves.toBeNull();
  });

  it('says it could not ask rather than throwing on an answer it cannot read', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: 'all of it' }),
    });

    await expect(fetchWatchProgress()).resolves.toBeNull();
  });

  it('tells an empty library apart from a question it could not ask', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ progress: [] }) });

    await expect(fetchWatchProgress()).resolves.toStrictEqual([]);
  });
});

describe('reportWatchProgress', () => {
  it('records the position against the item', async () => {
    await reportWatchProgress('abc', { positionSeconds: 90, durationSeconds: 7200 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/abc/progress',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('does not call something finished unless it is said to be', async () => {
    await reportWatchProgress('abc', { positionSeconds: 90, durationSeconds: 7200 });

    expect(sentBody()).toMatchObject({ isFinished: false });
  });

  it('records that something was finished when it was', async () => {
    await reportWatchProgress('abc', {
      positionSeconds: 7190,
      durationSeconds: 7200,
      isFinished: true,
    });

    expect(sentBody()).toMatchObject({ isFinished: true });
  });

  it('asks the browser to finish the report sent as a page goes away', async () => {
    await reportWatchProgress(
      'abc',
      { positionSeconds: 1800, durationSeconds: 7200 },
      { isLeaving: true },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/abc/progress',
      expect.objectContaining({ keepalive: true }),
    );
  });

  it('leaves an ordinary report as an ordinary request', async () => {
    await reportWatchProgress('abc', { positionSeconds: 90, durationSeconds: 7200 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/abc/progress',
      expect.objectContaining({ keepalive: false }),
    );
  });

  it('says nothing when it fails, rather than interrupting a film', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(
      reportWatchProgress('abc', { positionSeconds: 90, durationSeconds: 7200 }),
    ).resolves.toBeUndefined();
  });
});

describe('byMediaId', () => {
  it('lets a card ask about itself', () => {
    expect(byMediaId([PROGRESS]).get(PROGRESS.mediaId)).toEqual(PROGRESS);
  });

  it('knows nothing about an item nobody has watched', () => {
    expect(byMediaId([PROGRESS]).get('another')).toBeUndefined();
  });

  it('has nothing to say about a viewer who has watched nothing', () => {
    expect(byMediaId([]).size).toBe(0);
  });
});
