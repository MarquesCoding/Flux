import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTheApp } from '@FluxScreens/testing/renderTheApp';

const fetchMock = vi.fn<(target: string, init?: RequestInit) => Promise<Response>>();

const turnPushOn = vi.fn((key: string) => Promise.resolve(key !== ''));

const turnPushOff = vi.fn(() => Promise.resolve(undefined));

vi.mock('@FluxScreens/notifications/subscribeToPush', () => ({
  canReceivePush: () => true,
  subscribeToPush: (key: string) => turnPushOn(key),
  unsubscribeFromPush: () => turnPushOff(),
}));

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

const A_NOTICE = {
  id: '11111111-1111-4111-8111-111111111111',
  event: 'media.added',
  title: 'Arrival',
  body: 'Added to Films',
  link: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  readAt: null,
};

const sentTo = (path: string): string[] =>
  fetchMock.mock.calls
    .filter((call) => new URL(call[0], 'http://localhost:3000').pathname === path)
    .map((call) => (typeof call[1]?.body === 'string' ? call[1].body : ''));

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const A_LIBRARY = {
  id: LIBRARY_ID,
  name: 'Shows',
  kind: 'shows',
  path: '/media',
  itemCount: 1,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
};

const A_SHOW = {
  id: 'severance',
  libraryId: LIBRARY_ID,
  title: 'Severance',
  seasonCount: 1,
  episodeCount: 1,
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
};

const ok = (body: object | null) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchMock.mockReset();
  turnPushOn.mockClear();
  turnPushOff.mockClear();

  fetchMock.mockImplementation((target: string) => {
    const input = new URL(target, 'http://localhost:3000').pathname;

    if (input === '/api/setup/status') {
      return Promise.resolve(ok(SETUP));
    }

    if (input === '/api/notifications/read') {
      return Promise.resolve(ok({ unread: 0 }));
    }

    if (input.startsWith('/api/notifications/preferences')) {
      return Promise.resolve(ok({ preferences: [], pushPublicKey: 'a-public-key' }));
    }

    if (input.startsWith('/api/notifications')) {
      return Promise.resolve(ok({ notifications: [A_NOTICE], unread: 1 }));
    }

    if (input.endsWith('/shows')) {
      return Promise.resolve(ok({ shows: [A_SHOW] }));
    }

    if (input.startsWith('/api/libraries/') && input.includes('/items')) {
      return Promise.resolve(ok({ items: [], total: 0 }));
    }

    if (input.startsWith('/api/libraries')) {
      return Promise.resolve(ok([A_LIBRARY]));
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

  it('asks what is waiting again when the bell is opened', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));

    await waitFor(() => {
      expect(sentTo('/api/notifications').length).toBeGreaterThan(1);
    });
  });

  it('marks a notice read where it was pressed', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));
    await actor.click(await screen.findByRole('button', { name: /Arrival/ }));

    await waitFor(() => {
      expect(sentTo('/api/notifications/read')).toContain(JSON.stringify({ id: A_NOTICE.id }));
    });
  });

  it('crosses a notice off the moment it is read, rather than waiting to be told again', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(screen.getByRole('button', { name: /Mark all read/ })).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: /Arrival/ }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Mark all read/ })).not.toBeInTheDocument();
    });
  });

  it('marks everything read at once', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));
    await actor.click(await screen.findByRole('button', { name: /Mark all read/ }));

    await waitFor(() => {
      expect(sentTo('/api/notifications/read')).toContain(JSON.stringify({}));
    });
  });

  it('subscribes this browser to push when the bell offers it and it is turned on', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));
    await actor.click(await screen.findByRole('switch'));

    await waitFor(() => {
      expect(turnPushOn).toHaveBeenCalledWith('a-public-key');
    });
  });

  it('unsubscribes rather than subscribing again once push is already on', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    await actor.click(await screen.findByRole('button', { name: /Notifications/ }));

    const toggle = await screen.findByRole('switch');

    await actor.click(toggle);

    await waitFor(() => {
      expect(turnPushOn).toHaveBeenCalledOnce();
    });

    await actor.click(toggle);

    await waitFor(() => {
      expect(turnPushOff).toHaveBeenCalledOnce();
    });
  });

  it('opens the programme the address names, by looking through the libraries for it', async () => {
    window.history.replaceState(null, '', '/?show=severance');

    renderTheApp();

    expect(await screen.findByRole('dialog', { name: /Severance/ })).toBeInTheDocument();
  });

  it('takes the programme out of the address when its dialog is closed', async () => {
    const actor = userEvent.setup();

    window.history.replaceState(null, '', '/?show=severance');

    renderTheApp();

    const dialog = await screen.findByRole('dialog', { name: /Severance/ });

    await actor.click(within(dialog).getByRole('button', { name: /Close/ }));

    await waitFor(() => {
      expect(window.location.search).not.toContain('show=');
    });
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
