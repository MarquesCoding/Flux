import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLACEHOLDER, askTheServer, theAuthBase } from './askTheServer';

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
  it('asks the page its own origin, which is where every Valence client is served from', async () => {
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

describe('theAuthBase', () => {
  it('hands a browser its own origin, which the library is happy with', () => {
    vi.stubGlobal('location', { protocol: 'https:', origin: 'https://flux.example' });

    expect(theAuthBase()).toBe('https://flux.example');
  });

  it('hands a client that serves its own pages a base the library will accept', () => {
    vi.stubGlobal('location', { protocol: 'flux:', origin: 'flux://app' });

    expect(theAuthBase()).toBe(PLACEHOLDER);
  });
});

describe('a request that arrives already built', () => {
  it('is rebuilt where it carries a host that does not resolve', async () => {
    await askTheServer(new Request(`${PLACEHOLDER}/api/auth/get-session`));

    const [sent] = fetchMock.mock.calls[0] ?? [];
    const asked = sent instanceof Request ? sent.url : String(sent);

    expect(asked).not.toContain('flux.invalid');
  });

  it('is left alone where it is already asking for somewhere real', async () => {
    const built = new Request('http://localhost:8420/api/auth/get-session');

    await askTheServer(built);

    expect(fetchMock).toHaveBeenCalledWith(built, undefined);
  });
});
