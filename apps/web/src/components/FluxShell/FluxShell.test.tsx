import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTheApp } from '@FluxWeb/testing/renderTheApp';

const fetchMock = vi.fn();

vi.mock('@FluxWeb/realtime/getRealtimeClient', () => ({
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

const A_NOTICE = {
  id: '11111111-1111-4111-8111-111111111111',
  event: 'media.added',
  title: 'Arrival',
  body: 'Added to Films',
  link: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  readAt: null,
};

const ok = (body: object | null) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchMock.mockReset();

  fetchMock.mockImplementation((input: string) => {
    if (input === '/api/setup/status') {
      return Promise.resolve(ok(SETUP));
    }

    if (input.startsWith('/api/notifications/preferences')) {
      return Promise.resolve(ok({ preferences: [], pushPublicKey: '' }));
    }

    if (input.startsWith('/api/notifications')) {
      return Promise.resolve(ok({ notifications: [A_NOTICE], unread: 1 }));
    }

    if (input.startsWith('/api/libraries')) {
      return Promise.resolve(ok([]));
    }

    if (input.startsWith('/api/profiles/everyone')) {
      return Promise.resolve(ok({ profiles: [] }));
    }

    return Promise.resolve(ok({ user: OPERATOR }));
  });

  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FluxShell', () => {
  it('draws the dock every section sits inside', async () => {
    renderTheApp();

    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('says what is waiting on the bell', async () => {
    renderTheApp();

    expect(await screen.findByRole('button', { name: /Notifications/ })).toBeInTheDocument();
  });

  it('offers the admin page to an administrator', async () => {
    renderTheApp();

    const dock = await screen.findByRole('navigation', { name: 'Sections' });

    expect(within(dock).getByRole('button', { name: 'Admin' })).toBeInTheDocument();
  });

  it('opens the page somebody chose from the dock', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    const dock = await screen.findByRole('navigation', { name: 'Sections' });

    await actor.click(within(dock).getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/search');
    });
  });
});
