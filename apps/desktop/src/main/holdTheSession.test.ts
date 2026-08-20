import { beforeEach, describe, expect, it, vi } from 'vitest';

type Outgoing = { url: string; requestHeaders: Record<string, string> };

type Incoming = { url: string; responseHeaders: Record<string, string[]> };

const onBeforeSendHeaders = vi.fn<(listen: (d: Outgoing, respond: (a: object) => void) => void) => void>();

const onHeadersReceived = vi.fn<(listen: (d: Incoming, respond: (a: object) => void) => void) => void>();

vi.mock('electron', () => ({
  session: { defaultSession: { webRequest: { onBeforeSendHeaders, onHeadersReceived } } },
}));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({ theServerAddress: () => watching }));

let watching = 'https://flux.example.com';

let throughABrowser = '';

const { holdTheSession } = await import('./holdTheSession');

const theServerSets = (url: string, lines: string[]): void => {
  onHeadersReceived.mock.calls.at(-1)?.[0]({ url, responseHeaders: { 'Set-Cookie': lines } }, vi.fn());
};

const askingFor = (url: string) => {
  const respond = vi.fn();

  onBeforeSendHeaders.mock.calls.at(-1)?.[0]({ url, requestHeaders: { Accept: '*/*' } }, respond);

  return respond;
};

beforeEach(() => {
  onBeforeSendHeaders.mockClear();
  onHeadersReceived.mockClear();
  watching = 'https://flux.example.com';
  throughABrowser = '';
  holdTheSession({ getCookie: () => throughABrowser });
});

describe('holdTheSession', () => {
  it('keeps what the server set and sends it back, which is signing in', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc; HttpOnly']);

    expect(askingFor('https://flux.example.com/api/libraries')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*', Cookie: 's=abc' },
    });
  });

  it('signs the segments a video element asks for, which no script could', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc']);

    expect(askingFor('https://flux.example.com/api/playback/x/3.m4s')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*', Cookie: 's=abc' },
    });
  });

  it('keeps nothing a stranger sets, since that one belongs to somebody else', () => {
    theServerSets('https://images.example.org/poster.jpg', ['tracker=abc']);

    expect(askingFor('https://flux.example.com/api/libraries')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*' },
    });
  });

  it('sends nothing to a stranger, since that is a credential given away', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc']);

    expect(askingFor('https://images.example.org/poster.jpg')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*' },
    });
  });

  it('answers a request even where reading the address threw, since one nobody answers hangs', () => {
    watching = 'not an address';

    expect(askingFor('https://flux.example.com/api/libraries')).toHaveBeenCalledOnce();
  });

  it('falls back to a session got through a browser, which the jar never sees', () => {
    throughABrowser = 'better-auth.session_token=from-a-browser';

    expect(askingFor('https://flux.example.com/api/libraries')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*', Cookie: 'better-auth.session_token=from-a-browser' },
    });
  });

  it('prefers the one somebody signed in with here, where there is one', () => {
    throughABrowser = 'better-auth.session_token=from-a-browser';
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=signed-in-here']);

    expect(askingFor('https://flux.example.com/api/libraries')).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*', Cookie: 's=signed-in-here' },
    });
  });
});
