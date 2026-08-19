import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { authCookies } from '@FluxClient/session/authCookies';
import { rememberSessionToken, sessionToken } from '@FluxClient/session/sessionToken';
import { askTheServer } from './askTheServer';

const fetchMock = vi.fn<(input: string | Request, init?: RequestInit) => Promise<Response>>();

const said = (headers: Record<string, string> = {}): Response =>
  new Response('{}', { headers: { 'content-type': 'application/json', ...headers } });

const sent = (name: string): string | null =>
  new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get(name);

const watching = (server: string): void => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => server });
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(said());
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

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://flux.example.com/api/auth/get-session');
  });

  it('keeps the query, which is where better-auth puts what it is asking about', async () => {
    watching('https://flux.example.com');

    await askTheServer('http://flux.invalid/api/auth/list-passkeys?take=5');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://flux.example.com/api/auth/list-passkeys?take=5');
  });

  it('leaves a browser asking the server that served it', async () => {
    await askTheServer('/api/auth/get-session');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/get-session');
  });

  it('presents the token this client is holding', async () => {
    watching('https://flux.example.com');
    rememberSessionToken('a-session-token');

    await askTheServer('/api/auth/get-session');

    expect(sent('authorization')).toBe('Bearer a-session-token');
  });

  it('keeps the token the server hands back, so the next request is recognised', async () => {
    watching('https://flux.example.com');
    fetchMock.mockResolvedValue(said({ 'set-auth-token': 'a-fresh-token' }));

    await askTheServer('/api/auth/sign-in/email', { method: 'POST' });

    expect(sessionToken()).toBe('a-fresh-token');
  });

  it('keeps the challenge the server cannot send as a cookie', async () => {
    watching('https://flux.example.com');
    fetchMock.mockResolvedValue(said({ 'x-flux-set-auth-cookies': 'a.two_factor=abc' }));

    await askTheServer('/api/auth/sign-in/email', { method: 'POST' });

    expect(authCookies()).toBe('a.two_factor=abc');
  });

  it('hands the challenge back, which is the whole of answering a second factor', async () => {
    watching('https://flux.example.com');
    fetchMock.mockResolvedValue(said({ 'x-flux-set-auth-cookies': 'a.two_factor=abc' }));

    await askTheServer('/api/auth/sign-in/email', { method: 'POST' });
    await askTheServer('/api/auth/two-factor/verify-totp', { method: 'POST' });

    expect(sent('x-flux-auth-cookies')).toBe('a.two_factor=abc');
  });

  it('stops handing it back once the server says the challenge is over', async () => {
    watching('https://flux.example.com');
    fetchMock.mockResolvedValue(said({ 'x-flux-set-auth-cookies': 'a.two_factor=abc' }));
    await askTheServer('/api/auth/sign-in/email', { method: 'POST' });

    fetchMock.mockResolvedValue(said({ 'x-flux-set-auth-cookies': 'a.two_factor=' }));
    await askTheServer('/api/auth/two-factor/verify-totp', { method: 'POST' });

    await askTheServer('/api/auth/get-session');

    expect(sent('x-flux-auth-cookies')).toBeNull();
  });

  it('sends a browser nothing of its own, since its cookies are better than a copy', async () => {
    fetchMock.mockResolvedValue(said({ 'x-flux-set-auth-cookies': 'a.two_factor=abc' }));

    await askTheServer('/api/auth/sign-in/email', { method: 'POST' });
    await askTheServer('/api/auth/two-factor/verify-totp', { method: 'POST' });

    expect(sent('x-flux-auth-cookies')).toBeNull();
  });

  it('leaves a header the caller already set alone, since it knows something this does not', async () => {
    watching('https://flux.example.com');
    rememberSessionToken('a-session-token');

    await askTheServer('/api/auth/get-session', { headers: { authorization: 'Bearer another' } });

    expect(sent('authorization')).toBe('Bearer another');
  });

  it('moves a whole request onto the server too, since the library asks both ways', async () => {
    watching('https://flux.example.com');

    await askTheServer(new Request('http://flux.invalid/api/auth/get-session'));

    const asked = fetchMock.mock.calls[0]?.[0];

    expect(typeof asked === 'string' ? asked : asked?.url).toBe(
      'https://flux.example.com/api/auth/get-session',
    );
  });
});
