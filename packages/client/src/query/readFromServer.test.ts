import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { readFromServer } from './readFromServer';
import { RequestFailed } from './RequestFailed';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

const Schema = z.object({ profiles: z.array(z.string()) });

const said = (body: JsonValue, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readFromServer', () => {
  it('answers with what the server said, parsed', async () => {
    fetchMock.mockResolvedValue(said({ profiles: ['Marques'] }));

    await expect(readFromServer('/api/profiles', Schema)).resolves.toEqual({
      profiles: ['Marques'],
    });
  });

  it('asks for json, so a server that can answer either way answers this way', async () => {
    fetchMock.mockResolvedValue(said({ profiles: [] }));

    await readFromServer('/api/profiles', Schema);

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept')).toBe(
      'application/json',
    );
  });

  it('lets an empty answer mean the server said there is nothing', async () => {
    fetchMock.mockResolvedValue(said({ profiles: [] }));

    await expect(readFromServer('/api/profiles', Schema)).resolves.toEqual({ profiles: [] });
  });

  it('throws a refusal carrying the status, rather than answering with nothing', async () => {
    fetchMock.mockResolvedValue(said({}, 401));

    await expect(readFromServer('/api/profiles', Schema)).rejects.toThrow(RequestFailed);
    await expect(readFromServer('/api/profiles', Schema)).rejects.toMatchObject({
      status: 401,
      path: '/api/profiles',
    });
  });

  it('says which address was refused, since one screen reads several', async () => {
    fetchMock.mockResolvedValue(said({}, 500));

    await expect(readFromServer('/api/admin/roles', Schema)).rejects.toThrow(/api\/admin\/roles/);
  });

  it('lets a server that cannot be reached through, rather than dressing it as an answer', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(readFromServer('/api/profiles', Schema)).rejects.toThrow(TypeError);
  });

  it('refuses a body that is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({ profiles: 'not a list' }));

    await expect(readFromServer('/api/profiles', Schema)).rejects.toThrow();
  });
});
