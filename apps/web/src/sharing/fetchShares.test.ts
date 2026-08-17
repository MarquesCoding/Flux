import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShare, fetchShares, openShare, revokeShare, shareAddress } from './fetchShares';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

const said = (status: number, body: JsonValue) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
});

const MADE = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  token: 'a-token',
  kind: 'item' as const,
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  title: 'Arrival',
  createdAt: '2026-08-16T00:00:00.000Z',
  expiresAt: null,
  viewCap: null,
  views: 0,
  isRevoked: false,
  isSpent: false,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchShares', () => {
  it('reads the links this account handed out', async () => {
    fetchMock.mockResolvedValue(ok({ shares: [MADE] }));

    await expect(fetchShares()).resolves.toHaveLength(1);
  });

  it('answers with none where the request failed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchShares()).resolves.toEqual([]);
  });
});

describe('createShare', () => {
  it('hands back the link, whose token comes back this once', async () => {
    fetchMock.mockResolvedValue(said(201, MADE));

    await expect(createShare({ kind: 'item', mediaId: MADE.mediaId })).resolves.toEqual(MADE);
  });

  it('answers with nothing where the server refused', async () => {
    fetchMock.mockResolvedValue(said(403, { error: 'This account may not share.' }));

    await expect(createShare({ kind: 'item', mediaId: MADE.mediaId })).resolves.toBeNull();
  });
});

describe('revokeShare', () => {
  it('withdraws a link', async () => {
    fetchMock.mockResolvedValue(said(204, {}));

    await expect(revokeShare(MADE.id)).resolves.toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('says it did not work where the server refused', async () => {
    fetchMock.mockResolvedValue(said(404, {}));

    await expect(revokeShare(MADE.id)).resolves.toBe(false);
  });
});

describe('openShare', () => {
  it('opens what was shared', async () => {
    fetchMock.mockResolvedValue(ok({ kind: 'item', title: 'Arrival', items: [] }));

    const outcome = await openShare('a-token');

    expect(outcome.kind).toBe('opened');
  });

  it('tells a link that has run out apart from one that never existed', async () => {
    fetchMock.mockResolvedValue(said(410, { error: 'This link has expired.' }));

    const gone = await openShare('a-token');

    expect(gone).toEqual({ kind: 'gone', reason: 'This link has expired.' });

    fetchMock.mockResolvedValue(said(404, { error: 'This link does not work.' }));

    expect((await openShare('a-token')).kind).toBe('unknown');
  });

  it('escapes a token that needs it', async () => {
    fetchMock.mockResolvedValue(ok({ kind: 'item', title: 'Arrival', items: [] }));

    await openShare('a/b');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/share/a%2Fb');
  });
});

describe('shareAddress', () => {
  it('writes an address a friend can open', () => {
    expect(shareAddress('a-token', 'https://flux.example')).toBe(
      'https://flux.example/share/a-token',
    );
  });

  it('escapes a token that needs it', () => {
    expect(shareAddress('a/b', 'https://flux.example')).toBe('https://flux.example/share/a%2Fb');
  });
});
