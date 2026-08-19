import { beforeEach, describe, expect, it, vi } from 'vitest';

type Details = { url: string; requestHeaders: Record<string, string> };

type Respond = (answer: { requestHeaders: Record<string, string> }) => void;

type Listener = (details: Details, respond: Respond) => void;

const onBeforeSendHeaders = vi.fn<(listener: Listener) => void>();

vi.mock('electron', () => ({
  session: { defaultSession: { webRequest: { onBeforeSendHeaders } } },
}));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({
  theServerAddress: () => watching,
}));

let watching = 'https://flux.example.com';

const { carryTheSession } = await import('./carryTheSession');

const askingFor = (url: string, held: { getCookie: () => string }) => {
  carryTheSession(held);

  const respond = vi.fn();

  const listening = onBeforeSendHeaders.mock.calls.at(-1)?.[0];

  listening?.({ url, requestHeaders: { Accept: '*/*' } }, respond);

  return respond;
};

beforeEach(() => {
  onBeforeSendHeaders.mockClear();
  watching = 'https://flux.example.com';
});

describe('carryTheSession', () => {
  it('signs a request to the server this client watches', () => {
    const respond = askingFor('https://flux.example.com/api/libraries', {
      getCookie: () => 'flux.session=abc',
    });

    expect(respond).toHaveBeenCalledWith({
      requestHeaders: { Accept: '*/*', Cookie: 'flux.session=abc' },
    });
  });

  it('leaves a request to anywhere else exactly as it was', () => {
    const respond = askingFor('https://images.example.org/poster.jpg', {
      getCookie: () => 'flux.session=abc',
    });

    expect(respond).toHaveBeenCalledWith({ requestHeaders: { Accept: '*/*' } });
  });

  it('answers even where working out the session threw, since a request nobody answers hangs', () => {
    const respond = askingFor('https://flux.example.com/api/libraries', {
      getCookie: () => {
        throw new Error('The store could not be read.');
      },
    });

    expect(respond).toHaveBeenCalledWith({ requestHeaders: { Accept: '*/*' } });
  });

  it('answers where the address itself is unreadable, rather than stopping every request', () => {
    watching = 'not an address';

    const respond = askingFor('https://flux.example.com/api/libraries', {
      getCookie: () => 'flux.session=abc',
    });

    expect(respond).toHaveBeenCalledOnce();
  });

  it('answers exactly once, since Electron takes the first answer and holds the rest', () => {
    const respond = askingFor('https://flux.example.com/api/libraries', {
      getCookie: () => 'flux.session=abc',
    });

    expect(respond).toHaveBeenCalledOnce();
  });
});
