import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askTheServer } from './askTheServer';

const fetchMock = vi.fn<(input: string | Request, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('askTheServer', () => {
  it('asks the page its own origin, which is where every Flux client is served from', async () => {
    await askTheServer('/api/auth/get-session');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/get-session');
  });

  it('keeps what the caller asked with, rather than rebuilding the request', async () => {
    await askTheServer('/api/auth/sign-out', { method: 'POST' });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('reads the global when it is asked, not when the client was built', async () => {
    const second = vi.fn<() => Promise<Response>>(() => Promise.resolve(new Response('{}')));

    vi.stubGlobal('fetch', second);

    await askTheServer('/api/auth/get-session');

    expect(second).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks with a string where the library asked with a URL, which a caller may be expecting', async () => {
    await askTheServer(new URL('http://localhost/api/auth/get-session'));

    expect(typeof fetchMock.mock.calls[0]?.[0]).toBe('string');
  });
});
