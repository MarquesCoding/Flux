import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTheApp } from '@FluxScreens/testing/renderTheApp';

const fetchMock = vi.fn();

vi.mock('@FluxClient/realtime/getRealtimeClient', () => ({
  getRealtimeClient: () => ({
    start: () => undefined,
    stop: () => undefined,
    subscribe: () => () => undefined,
    identify: () => undefined,
    onResumed: () => () => undefined,
    isLive: () => true,
    connectionId: () => 'me',
    sendParty: () => undefined,
    askClock: () => undefined,
    onClockTell: () => () => undefined,
    onRefused: () => () => undefined,
    onNeedsPassword: () => () => undefined,
  }),
}));

const SETUP = {
  isComplete: true,
  detectedOrigin: 'http://local.dev',
  isSecureContext: true,
  suggestedTrustedOrigins: [],
};

const OPERATOR = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Operator',
  email: 'operator@flux.test',
  emailVerified: true,
  role: 'admin',
};

const ok = (body: object | null) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const serverWith = (session: object | null) => {
  fetchMock.mockImplementation((asked: string) => {
    const input = new URL(asked, 'http://localhost:3000').pathname;

    if (input === '/api/setup/status') {
      return Promise.resolve(ok(SETUP));
    }

    if (input.startsWith('/api/libraries')) {
      return Promise.resolve(ok([]));
    }

    if (input.startsWith('/api/profiles/everyone')) {
      return Promise.resolve(ok({ profiles: [] }));
    }

    if (input.startsWith('/api/auth/get-session')) {
      return Promise.resolve(ok(session));
    }

    return Promise.resolve(ok(session));
  });
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignedIn', () => {
  it('asks who is watching when nobody is', async () => {
    serverWith(null);
    renderTheApp();

    expect(await screen.findByRole('main')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/profiles/everyone', expect.anything());
    });
  });

  it('says the server is unreachable rather than asking somebody to sign in again', async () => {
    fetchMock.mockImplementation((input: string) =>
      input === '/api/setup/status'
        ? Promise.resolve(ok(SETUP))
        : Promise.reject(new Error('offline')),
    );

    renderTheApp();

    expect(
      await screen.findByRole('heading', { name: 'Valence is not reachable' }),
    ).toBeInTheDocument();
  });

  it('draws the pages beneath it once somebody is signed in', async () => {
    serverWith({ user: OPERATOR });
    renderTheApp();

    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });
});
