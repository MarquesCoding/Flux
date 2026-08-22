import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShare,
  fetchEverybodysShares,
  fetchShares,
  openShare,
  revokeAnybodysShare,
  revokeShare,
  shareAddress,
} from './fetchShares';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

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

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchShares()).rejects.toThrow();
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

describe('fetchEverybodysShares', () => {
  it('reads every link, and who handed each one out', async () => {
    const { token, ...withoutToken } = MADE;

    fetchMock.mockResolvedValue(
      ok({ shares: [{ ...withoutToken, createdBy: 'ada', createdByName: 'Ada' }] }),
    );

    expect(token).toBeTruthy();

    const everybody = await fetchEverybodysShares();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/shares', expect.anything());
    expect(everybody[0]?.createdByName).toBe('Ada');
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said(403, { error: 'no' }));

    await expect(fetchEverybodysShares()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(ok({ shares: [{ nothing: 'recognisable' }] }));

    await expect(fetchEverybodysShares()).rejects.toThrow();
  });
});

describe('revokeAnybodysShare', () => {
  it('withdraws anybody’s link through the admin route', async () => {
    fetchMock.mockResolvedValue(said(204, null));

    await expect(revokeAnybodysShare(MADE.id)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/shares/${MADE.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('says it did not where the server refused', async () => {
    fetchMock.mockResolvedValue(said(403, { error: 'no' }));

    await expect(revokeAnybodysShare(MADE.id)).resolves.toBe(false);
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

  it('falls back to withdrawn where the server names no ending it recognises', async () => {
    fetchMock.mockResolvedValue(said(410, { error: 'This link no longer works.' }));

    const gone = await openShare('a-token');

    expect(gone).toEqual({
      kind: 'gone',
      reason: 'This link no longer works.',
      ended: 'withdrawn',
    });
  });

  it('tells a link that has run out apart from one that never existed', async () => {
    fetchMock.mockResolvedValue(said(410, { error: 'This link has expired.', ended: 'expired' }));

    const gone = await openShare('a-token');

    expect(gone).toEqual({
      kind: 'gone',
      reason: 'This link has expired.',
      ended: 'expired',
    });

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

describe('when the server cannot be reached at all', () => {
  beforeEach(() => {
    fetchMock.mockRejectedValue(new Error('offline'));
  });

  it('makes no link, rather than throwing at whoever asked for one', async () => {
    await expect(createShare({ kind: 'item', mediaId: MADE.mediaId })).resolves.toBeNull();
  });

  it('reports a link as not withdrawn, rather than throwing', async () => {
    await expect(revokeShare(MADE.id)).resolves.toBe(false);
  });

  it('reports somebody else\u2019s link as not withdrawn either', async () => {
    await expect(revokeAnybodysShare(MADE.id)).resolves.toBe(false);
  });
});
