import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { JsonValueSchema, type JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const setupComplete = {
  isComplete: true,
  detectedOrigin: 'http://192.168.1.40:8420',
  isSecureContext: false,
  suggestedTrustedOrigins: ['http://192.168.1.40:8420'],
};

const user = {
  id: 'usr_1',
  name: 'Operator',
  email: 'admin@flux.test',
  emailVerified: false,
};

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

/**
 * What a request carried, read back as data rather than as a string.
 */
const bodyOf = (init: RequestInit | undefined): JsonValue =>
  JsonValueSchema.parse(JSON.parse(typeof init?.body === 'string' ? init.body : 'null'));

const arrivalId = '9c858901-8a57-4791-81fe-4c455b099bc9';

/**
 * Arrival as the server describes it in full, for the addresses that name an
 * item nothing has drawn yet.
 */
const arrivalInFull = {
  id: arrivalId,
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 10,
  canCopySegments: true,
  width: 1920,
  height: 1080,
  bitrateKbps: 12000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
} satisfies JsonValue;

const aLibraryWithArrival = {
  libraries: [
    {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      name: 'Films',
      kind: 'movies',
      path: '/media',
      itemCount: 1,
      lastScannedAt: null,

      defaultAudioLanguage: null,

      filesAtOnce: null,
    },
  ],
  items: {
    total: 1,
    items: [
      {
        id: '9c858901-8a57-4791-81fe-4c455b099bc9',
        libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        title: 'Arrival',
        year: 2016,
        durationSeconds: 7200,
        width: 1920,
        height: 1080,
        videoCodec: 'hevc',
        videoRange: 'HDR10',
        addedAt: '2026-08-10T00:00:00.000Z',
        hasPoster: false,
        hasBackdrop: false,
        hasLogo: false,
        seriesId: null,
      },
    ],
  },
} satisfies { libraries: JsonValue; items: JsonValue };

/**
 * Routes the two endpoints the shell depends on, so tests describe server
 * state rather than call ordering.
 */
const serverState = (options: {
  setup: JsonValue;
  session: JsonValue;
  libraries?: JsonValue;
  items?: JsonValue;
  detail?: JsonValue;
  watched?: JsonValue;
}) => {
  fetchMock.mockImplementation((input) => {
    if (input === '/api/setup/status') {
      return Promise.resolve(ok(options.setup));
    }

    if (input.startsWith('/api/libraries/') && input.includes('/items')) {
      return Promise.resolve(ok(options.items ?? { items: [], total: 0 }));
    }

    if (input.startsWith('/api/libraries')) {
      return Promise.resolve(ok(options.libraries ?? []));
    }

    if (input.startsWith('/api/profiles/everyone')) {
      return Promise.resolve(
        ok({
          profiles: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Operator',
              colour: '#3a8ee8',
              avatar: { kind: 'initial' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      );
    }

    if (input.startsWith('/api/progress')) {
      return Promise.resolve(ok({ progress: options.watched ?? [] }));
    }

    if (input.startsWith('/api/health')) {
      return Promise.resolve(ok({ version: '0.0.0' }));
    }

    if (input.startsWith('/api/media/')) {
      const isWholeItem = input === `/api/media/${arrivalId}`;

      return Promise.resolve(
        options.detail !== undefined && isWholeItem
          ? ok(options.detail)
          : { ok: false, status: 404, json: () => Promise.resolve(null) },
      );
    }

    return Promise.resolve(ok(options.session));
  });
};

/**
 * Stands in for presence's connection, opened once a viewer is signed in.
 *
 * Nothing here asserts against it — these are routing tests — but jsdom has
 * no `EventSource` of its own, and opening one for real would leave a
 * dangling connection every test would otherwise have to account for.
 */
class FakeEventSource {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  close() {}
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Lets the opening wordmark finish holding the screen.
 *
 * Flux opens on its own mark rather than on a spinner, so nothing else is
 * drawn until it has had its moment.
 */
const arrive = async () => {
  for (let pass = 0; pass < 2; pass += 1) {
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
};

describe('App routing', () => {
  it('shows a spinner while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    render(<App />);

    expect(screen.getByRole('status', { name: 'Loading Flux' })).toBeInTheDocument();
  });

  it('shows the setup wizard when setup is incomplete', async () => {
    serverState({ setup: { ...setupComplete, isComplete: false }, session: null });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Set up Flux' })).toBeInTheDocument();
  });

  it('does not ask for a session before setup is complete', async () => {
    serverState({ setup: { ...setupComplete, isComplete: false }, session: null });
    render(<App />);

    await screen.findByRole('heading', { name: 'Set up Flux' });

    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/get-session', expect.anything());
  });

  it('asks who is watching when setup is complete but nobody is signed in', async () => {
    serverState({ setup: setupComplete, session: null });
    render(<App />);

    await arrive();

    expect(await screen.findByText('Who is watching?')).toBeInTheDocument();
  });

  it('shows the library shell when signed in', async () => {
    serverState({ setup: setupComplete, session: { user } });
    render(<App />);

    await arrive();

    const dock = await screen.findByRole('navigation', { name: 'Sections' });

    expect(within(dock).getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('calls the instance whatever it is configured to be called', async () => {
    serverState({ setup: setupComplete, session: null });
    render(<App initialTitle="Living Room" />);

    await arrive();

    expect(screen.getAllByText(/Living Room/).length).toBeGreaterThan(0);
  });

  it('puts a person\u2019s own name at the top of their account page', async () => {
    serverState({ setup: setupComplete, session: { user } });
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialTitle="Living Room" />);

    await arrive();
    await actor.click(await screen.findByRole('button', { name: 'Account' }));

    expect(await screen.findByRole('heading', { name: 'Operator' })).toBeInTheDocument();
  });

  it('reports an unreachable server rather than assuming setup is needed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Flux is not reachable' }),
    ).toBeInTheDocument();
  });

  it('does not show sign in when the session request fails', async () => {
    fetchMock.mockImplementation((input) =>
      input === '/api/setup/status'
        ? Promise.resolve(ok(setupComplete))
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) }),
    );
    render(<App />);

    await screen.findByRole('heading', { name: 'Flux is not reachable' });

    expect(screen.queryByText('Who is watching?')).not.toBeInTheDocument();
  });

  it('signs out and returns to the wall of faces', async () => {
    serverState({ setup: setupComplete, session: { user } });
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await arrive();
    await actor.click(await screen.findByRole('button', { name: 'Account' }));
    await screen.findByText('admin@flux.test');

    serverState({ setup: setupComplete, session: null });
    await actor.click(screen.getByRole('button', { name: /Sign out/ }));
    await arrive();

    expect(await screen.findByText('Who is watching?')).toBeInTheDocument();
  });

  it('opens an item for a look rather than playing it straight away', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));

    expect(await screen.findByRole('dialog', { name: 'Arrival' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /Seek through/ })).not.toBeInTheDocument();
  });

  it('fills the page with the player once someone presses play', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));
    await actor.click(await screen.findByRole('button', { name: 'Play' }));

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('keeps a position it has just seen, rather than the one the server still believes', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const arrival = aLibraryWithArrival.items.items[0];

    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));
    await actor.click(await screen.findByRole('button', { name: 'Play' }));

    const player = await screen.findByLabelText('Arrival');

    Object.defineProperty(player, 'currentTime', { configurable: true, value: 1800 });

    await act(async () => {
      player.dispatchEvent(new Event('timeupdate'));
      await Promise.resolve();
    });

    await actor.click(screen.getByRole('button', { name: 'Close' }));

    expect(arrival?.id).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Resume from 30:00/)).toBeInTheDocument();
    });
  });

  it('moves to the section chosen from the dock', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const dock = await screen.findByRole('navigation', { name: 'Sections' });

    await actor.click(within(dock).getByRole('button', { name: 'Films' }));

    expect(await screen.findByRole('heading', { name: 'Films' })).toBeInTheDocument();
  });

  it('opens something chosen at random', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    await actor.click(await screen.findByRole('button', { name: 'Randomiser' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('goes back to the library once setup is finished', async () => {
    serverState({ setup: { ...setupComplete, isComplete: false }, session: null });
    render(<App />);

    await screen.findByRole('heading', { name: 'Set up Flux' });

    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });

    expect(await screen.findByRole('heading', { name: 'Set up Flux' })).toBeInTheDocument();
  });

  it('closes an item that was opened for a look', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));
    await screen.findByRole('dialog', { name: 'Arrival' });

    await actor.click(screen.getByRole('button', { name: /^Close$/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Arrival' })).not.toBeInTheDocument();
    });
  });

  it('plays what an address names, without anything having been browsed first', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
    });
    render(<App />);

    await arrive();

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument();
  });

  it('ignores a second left in an address, the server holding the only position', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}?t=1800`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 40,
          durationSeconds: 7200,
          isFinished: false,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    await waitFor(() => {
      const asked = fetchMock.mock.calls.find(([input]) =>
        input.includes(`/api/playback/${arrivalId}/session`),
      );

      expect(bodyOf(asked?.[1])).toMatchObject({ startSeconds: 40 });
    });
  });

  it('keeps no second in the address while watching', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 40,
          durationSeconds: 7200,
          isFinished: false,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    expect(window.location.pathname).toBe(`/watch/${arrivalId}`);
    expect(window.location.search).toBe('');
  });

  it('starts again from nothing when that is what was asked for', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 2400,
          durationSeconds: 7200,
          isFinished: false,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));
    await actor.click(await screen.findByRole('button', { name: /Start again/ }));

    await waitFor(() => {
      const asked = fetchMock.mock.calls.find(([input]) =>
        input.includes(`/api/playback/${arrivalId}/session`),
      );

      expect(bodyOf(asked?.[1])).toMatchObject({ startSeconds: 0 });
    });
  });
  it('carries on from where the server says, when the address names no second', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 2400,
          durationSeconds: 7200,
          isFinished: false,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    await waitFor(() => {
      const asked = fetchMock.mock.calls.find(([input]) =>
        input.includes(`/api/playback/${arrivalId}/session`),
      );

      expect(bodyOf(asked?.[1])).toMatchObject({ startSeconds: 2400 });
    });
  });

  it('gives up on an address naming something the server no longer has', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    expect(await screen.findByRole('region', { name: 'Recently added' })).toBeInTheDocument();
  });

  it('carries on from a position too early to be worth offering as a resume', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 40,
          durationSeconds: 7200,
          isFinished: false,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    await waitFor(() => {
      const asked = fetchMock.mock.calls.find(([input]) =>
        input.includes(`/api/playback/${arrivalId}/session`),
      );

      expect(bodyOf(asked?.[1])).toMatchObject({ startSeconds: 40 });
    });
  });

  it('starts something already finished again, rather than at its credits', async () => {
    window.history.replaceState(null, '', `/watch/${arrivalId}`);

    serverState({
      setup: setupComplete,
      session: { user },
      ...aLibraryWithArrival,
      detail: arrivalInFull,
      watched: [
        {
          mediaId: arrivalId,
          positionSeconds: 7150,
          durationSeconds: 7200,
          isFinished: true,
          updatedAt: '2026-08-15T00:00:00.000Z',
        },
      ],
    });
    render(<App />);

    await arrive();

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    await waitFor(() => {
      const asked = fetchMock.mock.calls.find(([input]) =>
        input.includes(`/api/playback/${arrivalId}/session`),
      );

      expect(bodyOf(asked?.[1])).toMatchObject({ startSeconds: 0 });
    });
  });

  it('remembers where somebody got to when the player is closed', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival });
    render(<App />);

    await arrive();

    const rail = await screen.findByRole('region', { name: 'Recently added' });

    await actor.click(within(rail).getByRole('button', { name: /Arrival/ }));
    await actor.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress'),
      expect.anything(),
    );
  });
});
