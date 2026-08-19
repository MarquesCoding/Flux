import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { askTheServer } from './askTheServer';

const fetchMock = vi.fn<(input: string | Request, init?: RequestInit) => Promise<Response>>();

const watching = (server: string): void => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => server });
};

const askedFor = (): string | undefined => {
  const asked = fetchMock.mock.calls[0]?.[0];

  return typeof asked === 'string' ? asked : asked?.url;
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  watching('');
});

afterEach(() => {
  forgetPlatform();
  vi.unstubAllGlobals();
});

describe('askTheServer', () => {
  it('puts the path on the server this client watches', async () => {
    watching('https://flux.example.com');

    await askTheServer('http://flux.invalid/api/auth/get-session');

    expect(askedFor()).toBe('https://flux.example.com/api/auth/get-session');
  });

  it('keeps the query, which is where better-auth puts what it is asking about', async () => {
    watching('https://flux.example.com');

    await askTheServer('http://flux.invalid/api/auth/list-passkeys?take=5');

    expect(askedFor()).toBe('https://flux.example.com/api/auth/list-passkeys?take=5');
  });

  it('leaves a browser asking the server that served it', async () => {
    await askTheServer('/api/auth/get-session');

    expect(askedFor()).toBe('/api/auth/get-session');
  });

  it('moves a whole request onto the server too, since the library asks both ways', async () => {
    watching('https://flux.example.com');

    await askTheServer(new Request('http://flux.invalid/api/auth/get-session'));

    expect(askedFor()).toBe('https://flux.example.com/api/auth/get-session');
  });

  it('keeps what the caller asked with, rather than rebuilding the request', async () => {
    watching('https://flux.example.com');

    await askTheServer('/api/auth/sign-out', { method: 'POST' });

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });
});
