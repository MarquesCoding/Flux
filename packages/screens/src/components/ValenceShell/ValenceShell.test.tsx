import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTheApp } from '@ValenceScreens/testing/renderTheApp';

const fetchMock = vi.fn<(target: string, init?: RequestInit) => Promise<Response>>();

const turnPushOn = vi.fn((key: string) => Promise.resolve(key !== ''));

const turnPushOff = vi.fn(() => Promise.resolve(undefined));

vi.mock('@ValenceScreens/notifications/subscribeToPush', () => ({
  canReceivePush: () => true,
  subscribeToPush: (key: string) => turnPushOn(key),
  unsubscribeFromPush: () => turnPushOff(),
}));

vi.mock('@ValenceClient/realtime/getRealtimeClient', () => ({
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
  email: 'operator@valence.test',
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

let mayAdminister = true;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  fetchMock.mockReset();
  mayAdminister = true;
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

    if (input === '/api/account/permissions') {
      return Promise.resolve(
        ok({
          permissions: mayAdminister ? ['administrator'] : [],
          isAdministrator: mayAdminister,
        }),
      );
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

describe('ValenceShell', () => {
  it('draws the dock every section sits inside', async () => {
    renderTheApp();

    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('says what is waiting on the bell', async () => {
    renderTheApp();

    expect(await screen.findByRole('button', { name: /Notifications/ })).toBeInTheDocument();
  });

  it('offers the admin page to an administrator, from the menu on their face', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await actor.click(within(bar).getByRole('button', { name: 'Account' }));

    expect(await screen.findByRole('menuitem', { name: 'Admin' })).toBeInTheDocument();
  });

  it('offers it from what the server says this account may do, not from the session', async () => {
    const actor = userEvent.setup();

    mayAdminister = false;

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await actor.click(within(bar).getByRole('button', { name: 'Account' }));

    expect(await screen.findByRole('menuitem', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('keeps the server shut to somebody who is not an administrator, however they reached it', async () => {
    mayAdminister = false;

    window.history.replaceState(null, '', '/admin');

    renderTheApp();

    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'The server' })).not.toBeInTheDocument();
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

  it('raises search over the page somebody was on, rather than leaving it', async () => {
    const actor = userEvent.setup();

    renderTheApp();

    const dock = await screen.findByRole('navigation', { name: 'Sections' });

    await actor.click(within(dock).getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      expect(window.location.search).toContain('search=open');
    });
  });
});

const A_FILM = {
  id: 'aa0e8400-e29b-41d4-a716-446655440000',
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
};

/**
 * Answers for the libraries this test needs, and the films in them, leaving everything else as
 * the suite answers it.
 */
const serveLibraries = (libraries: object[], films: object[] = []) => {
  const underneath = fetchMock.getMockImplementation();

  fetchMock.mockImplementation((target: string, init?: RequestInit) => {
    const url = new URL(target, 'http://localhost:3000');

    if (url.pathname.startsWith('/api/libraries/') && url.pathname.includes('/items')) {
      const found = url.searchParams.get('kind') === 'films' ? films : [];

      return Promise.resolve(ok({ items: found, total: found.length }));
    }

    if (url.pathname === '/api/libraries') {
      return Promise.resolve(ok(libraries));
    }

    if (url.pathname === '/api/library-facets') {
      return Promise.resolve(ok({ genres: ['Drama', 'Comedy'], decades: [], maxRating: 10 }));
    }

    return underneath === undefined ? Promise.resolve(ok({})) : underneath(target, init);
  });
};

const A_BOOK_LIBRARY = {
  ...A_LIBRARY,
  id: '4f2504e0-4f89-41d3-9a0c-0305e82c3302',
  name: 'Books',
  kind: 'books',
  itemCount: 2,
};

const A_FILM_LIBRARY = {
  ...A_LIBRARY,
  id: '5f2504e0-4f89-41d3-9a0c-0305e82c3303',
  name: 'Films',
  kind: 'movies',
};

describe('the places a server with little in it offers', () => {
  it('offers programmes once a library of them holds something', async () => {
    serveLibraries([A_LIBRARY]);

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await waitFor(() => {
      expect(within(bar).queryByRole('button', { name: 'Films' })).not.toBeInTheDocument();
    });

    expect(within(bar).getByRole('button', { name: 'Shows' })).toBeInTheDocument();
  });

  it('offers no programmes while their library is empty', async () => {
    serveLibraries([{ ...A_LIBRARY, itemCount: 0 }]);

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await waitFor(() => {
      expect(within(bar).queryByRole('button', { name: 'Shows' })).not.toBeInTheDocument();
    });
  });

  it('offers films once there is a film to find', async () => {
    serveLibraries([A_FILM_LIBRARY], [A_FILM]);

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await waitFor(() => {
      expect(within(bar).queryByRole('button', { name: 'Books' })).not.toBeInTheDocument();
    });

    expect(within(bar).getByRole('button', { name: 'Films' })).toBeInTheDocument();
  });

  it('offers books once a library of them holds one', async () => {
    serveLibraries([A_BOOK_LIBRARY]);

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await waitFor(() => {
      expect(within(bar).queryByRole('button', { name: 'Shows' })).not.toBeInTheDocument();
    });

    expect(within(bar).getByRole('button', { name: 'Books' })).toBeInTheDocument();
  });

  it('offers no books while their library is empty', async () => {
    serveLibraries([{ ...A_BOOK_LIBRARY, itemCount: 0 }]);

    renderTheApp();

    const bar = await screen.findByRole('navigation', { name: 'Sections' });

    await waitFor(() => {
      expect(within(bar).queryByRole('button', { name: 'Books' })).not.toBeInTheDocument();
    });
  });
});
