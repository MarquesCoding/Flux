import { beforeEach, describe, expect, it, vi } from 'vitest';

type Incoming = { url: string; responseHeaders: Record<string, string[]> };

const onHeadersReceived =
  vi.fn<(listen: (d: Incoming, respond: (a: object) => void) => void) => void>();

const set = vi.fn();

vi.mock('electron', () => ({
  session: { defaultSession: { webRequest: { onHeadersReceived }, cookies: { set } } },
}));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({ theServerAddress: () => watching }));

let watching = 'https://flux.example.com';

const { alsoKeep, keepTheServersCookies } = await import('./keepTheServersCookies');

const theServerSets = (url: string, lines: string[]) => {
  const respond = vi.fn();

  onHeadersReceived.mock.calls.at(-1)?.[0]({ url, responseHeaders: { 'Set-Cookie': lines } }, respond);

  return respond;
};

beforeEach(() => {
  onHeadersReceived.mockClear();
  set.mockClear();
  watching = 'https://flux.example.com';
  keepTheServersCookies();
});

describe('keepTheServersCookies', () => {
  it('keeps what the server set, so the engine sends it back by itself', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc; HttpOnly']);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://flux.example.com', name: 's', value: 'abc' }),
    );
  });

  it('changes the one attribute that would stop it being sent to a stranger', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc; SameSite=Lax']);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ sameSite: 'no_restriction' }));
  });

  it('marks it secure for a server reached over TLS, which that attribute requires', () => {
    theServerSets('https://flux.example.com/api/auth/sign-in/email', ['s=abc']);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it('keeps nothing a stranger set, since that one belongs to somebody else', () => {
    theServerSets('https://images.example.org/poster.jpg', ['tracker=abc']);

    expect(set).not.toHaveBeenCalled();
  });

  it('answers every response, since one nobody answers hangs', () => {
    watching = 'not an address';

    expect(theServerSets('https://flux.example.com/x', ['s=abc'])).toHaveBeenCalledOnce();
  });

  it('leaves the response exactly as it was, since this only watches', () => {
    const respond = theServerSets('https://flux.example.com/x', ['s=abc']);

    expect(respond).toHaveBeenCalledWith({ responseHeaders: { 'Set-Cookie': ['s=abc'] } });
  });
});

describe('alsoKeep', () => {
  it('hands over a session got through a browser, which the engine never saw set', () => {
    alsoKeep('better-auth.session_token=from-a-browser');

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'better-auth.session_token', value: 'from-a-browser' }),
    );
  });

  it('does nothing where there is none, which is every ordinary launch', () => {
    alsoKeep('');

    expect(set).not.toHaveBeenCalled();
  });

  it('does nothing before anybody has said where their Flux is', () => {
    watching = '';

    alsoKeep('s=abc');

    expect(set).not.toHaveBeenCalled();
  });
});
