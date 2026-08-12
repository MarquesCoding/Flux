import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AdminArea } from './AdminArea';
import { resetForTests as resetScanCoordinator } from './scanCoordinator';
import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

const OVERVIEW: AdminOverview = {
  users: [
    {
      id: 'abc',
      name: 'Marques',
      email: 'marques@flux.local',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  settings: {
    hasCatalogueKey: false,
    trustedOrigins: ['http://localhost:5173'],
    cookieSecure: false,
  },
  transcoder: { isReachable: true, ffmpegVersion: '9.0.1', hardwareAccels: ['videotoolbox'] },
  library: { itemCount: 15, libraryCount: 2 },
};

const MONITOR: Monitor = {
  resources: {
    atMs: 1,
    systemCpuPercent: 42,
    systemMemoryUsedBytes: 8 * 1024 ** 3,
    systemMemoryTotalBytes: 16 * 1024 ** 3,
    cpuCount: 10,
    serviceCpuPercent: 3,
    serviceMemoryBytes: 200 * 1024 ** 2,
    children: [{ pid: 4242, cpuPercent: 190, memoryBytes: 300 * 1024 ** 2 }],
    loadAverage: 1.5,
  },
  queue: {
    concurrency: 2,
    queued: 1,
    running: 1,
    jobs: [
      {
        id: 1,
        kind: 'preview',
        subject: 'Parasite (2019).mkv',
        state: 'running',
        queuedAtMs: 0,
        startedAtMs: 0,
        finishedAtMs: null,
        detail: null,
      },
      {
        id: 2,
        kind: 'thumbnails',
        subject: 'Interstellar (2014).mkv',
        state: 'failed',
        queuedAtMs: 0,
        startedAtMs: 0,
        finishedAtMs: 900,
        detail: 'no such encoder',
      },
    ],
  },
  sessions: 1,
  logs: [{ atMs: 0, level: 'error', source: 'transcoder', message: 'Could not open the file' }],
};

const MOVIES_LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const LIBRARIES: Library[] = [
  {
    id: MOVIES_LIBRARY_ID,
    name: 'Movies',
    kind: 'movies',
    path: '/media/movies',
    itemCount: 42,
    lastScannedAt: null,

    defaultAudioLanguage: null,
  },
];

const CREATED_LIBRARY: Library = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Shows',
  kind: 'shows',
  path: '/media/shows',
  itemCount: 0,
  lastScannedAt: null,

  defaultAudioLanguage: null,
};

const SHOWS_LIBRARY_ID = '22222222-2222-4222-8222-222222222222';

const TWO_LIBRARIES: Library[] = [
  ...LIBRARIES,
  {
    id: SHOWS_LIBRARY_ID,
    name: 'Shows',
    kind: 'shows',
    path: '/media/shows',
    itemCount: 5,
    lastScannedAt: null,

    defaultAudioLanguage: null,
  },
];

const fetchMock = vi.fn();

/**
 * Answers whatever the admin page's requests ask for.
 *
 * One implementation shared by every test rather than one per test, so a
 * test that overrides the overview does not have to relearn how libraries,
 * scans and the monitor stream are answered too.
 */
type FakeSession = {
  clientId: string;
  profileId: string | null;
  profileName: string | null;
  deviceLabel: string;
  connectedAt: number;
  playback: {
    mediaId: string;
    mediaTitle: string;
    hasPoster: boolean;
    hasBackdrop: boolean;
    mode: 'direct' | 'transcode';
    plan: PlaybackPlan;
    isPlaying: boolean;
    pausedByAdmin: boolean;
    startedAt: number;
    health: {
      positionSeconds: number;
      durationSeconds: number;
      bufferedAheadSeconds: number;
      presentedWidth: number;
      presentedHeight: number;
    } | null;
  } | null;
};

const planReason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const FAKE_PLAN: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason: planReason },
  video: { kind: 'passthrough', reason: planReason },
  audio: { kind: 'passthrough', streamIndex: 1, reason: planReason },
  subtitles: { kind: 'none', reason: planReason },
};

const JOB_DEFINITIONS = [
  {
    kind: 'library.scan',
    label: 'Scan for changes',
    description: 'Finds new, changed and removed files.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.regeneratePreviews',
    label: 'Regenerate previews',
    description: "Rebuilds preview clips using the library's forced audio language.",
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.regenerateTrickplay',
    label: 'Regenerate thumbnails',
    description: 'Rebuilds scrubbing thumbnail sheets for every item.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.detectSegments',
    label: 'Detect intros and outros',
    description: 'Finds skippable segments using chapters and audio fingerprints.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.reset',
    label: 'Reset and rebuild',
    description: 'Deletes everything in the library, then scans it from nothing.',
    needsLibrary: true,
    destructive: true,
  },
];

const respondWith =
  (overview: typeof OVERVIEW = OVERVIEW, sessions: readonly FakeSession[] = []) =>
  (input: string, init?: RequestInit) => {
    if (input.includes('/api/admin/sessions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(init?.method === 'DELETE' ? {} : sessions),
      });
    }

    if (input.includes('/api/admin/jobs/definitions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ definitions: JOB_DEFINITIONS }),
      });
    }

    if (input.includes('/api/admin/jobs/schedules')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ schedules: [] }),
      });
    }

    if (input.includes('/triggers')) {
      const sent = z
        .object({ trigger: z.unknown() })
        .safeParse(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'trigger-1', trigger: sent.success ? sent.data.trigger : null }),
      });
    }

    if (input.includes('/api/admin/jobs/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: 'admin-job', state: 'queued' }),
      });
    }

    if (input.includes('/scans/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            jobId: 'scan-job',
            state: 'completed',
            phase: 'previews',
            processed: 1,
            total: 1,
          }),
      });
    }

    if (input.includes('/scan')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: 'scan-job', state: 'queued' }),
      });
    }

    if (input.includes('/reset')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: 'reset-job', state: 'queued' }),
      });
    }

    if (input.includes('/api/libraries') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CREATED_LIBRARY) });
    }

    if (input.includes('/api/libraries')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(LIBRARIES) });
    }

    if (input.includes('monitor')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MONITOR) });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve(overview) });
  };

class FakeEventSource {
  static last: FakeEventSource | null = null;

  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  isClosed = false;

  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }

  close() {
    this.isClosed = true;
  }
}

beforeEach(() => {
  FakeEventSource.last = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(respondWith());
  resetScanCoordinator();

  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Chooses something from a job's actions menu on the Jobs section.
 */
const chooseJob = async (
  actor: ReturnType<typeof userEvent.setup>,
  job: string,
  action: RegExp,
) => {
  await actor.click(await screen.findByRole('button', { name: `Actions for ${job}` }));
  await actor.click(await screen.findByRole('menuitem', { name: action }));
};

/**
 * Chooses something from a library's actions menu.
 */
const chooseLibrary = async (
  actor: ReturnType<typeof userEvent.setup>,
  name: string,
  action: RegExp,
) => {
  await actor.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await actor.click(await screen.findByRole('menuitem', { name: action }));
};

describe('AdminArea', () => {
  it('says whether the media service is up', async () => {
    render(<AdminArea />);

    expect(await screen.findByText(/Media service up/)).toBeInTheDocument();
  });

  it('says when the media service is not up, which is the thing worth knowing', async () => {
    fetchMock.mockImplementation(
      respondWith({
        ...OVERVIEW,
        transcoder: { isReachable: false, ffmpegVersion: null, hardwareAccels: [] },
      }),
    );

    render(<AdminArea />);

    expect(await screen.findByText('Media service unreachable')).toBeInTheDocument();
  });

  it('keeps the figures worth half an eye on', async () => {
    render(<AdminArea />);

    expect(await screen.findByText('42%')).toBeInTheDocument();
  });

  it('watches rather than asking every second whether anything happened', () => {
    render(<AdminArea />);

    expect(FakeEventSource.last?.url).toBe('/api/admin/monitor/stream');
  });

  it('follows the machine as it changes', async () => {
    render(<AdminArea />);

    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    FakeEventSource.last?.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          ...MONITOR,
          resources: { ...MONITOR.resources, systemCpuPercent: 91 },
        }),
      }),
    );

    expect(await screen.findByText('91%')).toBeInTheDocument();
  });

  it('stops watching once the page is left', () => {
    const { unmount } = render(<AdminArea />);

    unmount();

    expect(FakeEventSource.last?.isClosed).toBe(true);
  });

  it('shows what the media service is working on', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));

    expect(screen.getByText('Parasite (2019).mkv')).toBeInTheDocument();
  });

  it('opens on the panel the address named, so a reload lands back where it was', async () => {
    render(<AdminArea initialPanel="jobs" />);

    expect(await screen.findByText('Background jobs')).toBeInTheDocument();
  });

  it('opens on the overview when the address names no panel', async () => {
    render(<AdminArea />);

    expect(await screen.findByText('Load, last minute')).toBeInTheDocument();
  });

  it('falls back to the overview when the address names one it does not have', async () => {
    render(<AdminArea initialPanel="not-a-real-panel" />);

    expect(await screen.findByText('Load, last minute')).toBeInTheDocument();
  });

  it('tells the address when the panel changes, so a reload can return to it', async () => {
    const actor = userEvent.setup();
    const onPanelChange = vi.fn();

    render(<AdminArea onPanelChange={onPanelChange} />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));

    expect(onPanelChange).toHaveBeenCalledWith('jobs');
  });

  it('says why a job failed rather than only that it did', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));

    expect(screen.getAllByText('no such encoder').length).toBeGreaterThan(0);
  });

  it('lets an admin start any job on demand from the Work tab', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));

    expect(await screen.findByText('Scan for changes')).toBeInTheDocument();
    expect(screen.getByText('Reset and rebuild')).toBeInTheDocument();

    await chooseJob(actor, 'Scan for changes', /Run now/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/jobs/library.scan/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('runs a library job against every library at once from the Work tab', async () => {
    fetchMock.mockImplementation((input: string, init?: RequestInit) =>
      input === '/api/libraries'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(TWO_LIBRARIES) })
        : respondWith()(input, init),
    );

    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Scan for changes', /Run now/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/jobs/library.scan/run',
        expect.objectContaining({
          body: JSON.stringify({ libraryId: MOVIES_LIBRARY_ID }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/jobs/library.scan/run',
        expect.objectContaining({
          body: JSON.stringify({ libraryId: SHOWS_LIBRARY_ID }),
        }),
      );
    });
  });

  it('asks for confirmation before running Reset and rebuild from the Work tab', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Reset and rebuild', /Run now/);

    expect(await screen.findByRole('heading', { name: 'Reset and rebuild?' })).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/jobs/library.reset/run',
      expect.anything(),
    );
  });

  it('opens a job schedule over the list by pressing into its row, not its Run button', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Scan for changes', /Edit schedule/);

    const schedule = await screen.findByRole('dialog');

    expect(within(schedule).getByText('Scan for changes')).toBeInTheDocument();
    expect(screen.getByText('Background jobs')).toBeInTheDocument();
  });

  it('adds a trigger to a job from its own schedule page', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Scan for changes', /Edit schedule/);
    await actor.click(await screen.findByRole('button', { name: 'Add trigger' }));
    await actor.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/jobs/library.scan/triggers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ trigger: { kind: 'daily', hour: 3, minute: 0 } }),
        }),
      );
    });

    expect(await screen.findByText('Daily at 03:00')).toBeInTheDocument();
  });

  it('removes a trigger from a job schedule page', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Scan for changes', /Edit schedule/);
    await actor.click(await screen.findByRole('button', { name: 'Add trigger' }));
    await actor.click(await screen.findByRole('button', { name: 'Add' }));
    await actor.click(await screen.findByRole('button', { name: 'Remove Daily at 03:00' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/jobs/library.scan/triggers/trigger-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    expect(screen.queryByText('Daily at 03:00')).toBeNull();
  });

  it('closes a schedule without leaving the job list', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Jobs' }));
    await chooseJob(actor, 'Scan for changes', /Edit schedule/);
    await actor.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Done' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Actions for Scan for changes' }),
    ).toBeInTheDocument();
  });

  it('lets an operator set the catalogue key', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Settings' }));
    await actor.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await actor.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings', expect.anything());
    });
  });

  it('keeps who has an account out of settings, since Accounts is where they live', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(await screen.findByText('Signing in')).toBeInTheDocument();
    expect(screen.queryByText('marques@flux.local')).not.toBeInTheDocument();
  });

  it('draws something rather than nothing before the server has answered', () => {
    render(<AdminArea />);

    expect(screen.getByRole('heading', { level: 1, name: 'Server' })).toBeInTheDocument();
  });

  it('says nobody has the app open when nobody does', async () => {
    render(<AdminArea initialPanel="activity" />);

    expect(await screen.findByText('Nobody has the app open right now.')).toBeInTheDocument();
  });

  it('lists a stream in progress', async () => {
    const session: FakeSession = {
      clientId: 'tab-1',
      profileId: 'profile-1',
      profileName: 'Dan',
      deviceLabel: 'Living room TV',
      connectedAt: 1000,
      playback: {
        mediaId: 'media-1',
        mediaTitle: 'Arrival',
        hasPoster: false,
        hasBackdrop: false,
        mode: 'direct',
        plan: FAKE_PLAN,
        isPlaying: true,
        pausedByAdmin: false,
        startedAt: 1500,
        health: null,
      },
    };

    fetchMock.mockImplementation(respondWith(OVERVIEW, [session]));

    render(<AdminArea initialPanel="activity" />);

    expect(await screen.findByText(/Arrival/)).toBeInTheDocument();
    expect(screen.getByText(/Playing/)).toBeInTheDocument();
    expect(screen.getByText('Living room TV')).toBeInTheDocument();
    expect(screen.getAllByText('Dan').length).toBeGreaterThan(0);
    expect(screen.getByText('Direct')).toBeInTheDocument();
  });

  it('stops a stream on request', async () => {
    const session: FakeSession = {
      clientId: 'tab-1',
      profileId: 'profile-1',
      profileName: 'Dan',
      deviceLabel: 'Living room TV',
      connectedAt: 1000,
      playback: {
        mediaId: 'media-1',
        mediaTitle: 'Arrival',
        hasPoster: false,
        hasBackdrop: false,
        mode: 'direct',
        plan: FAKE_PLAN,
        isPlaying: true,
        pausedByAdmin: false,
        startedAt: 1500,
        health: null,
      },
    };

    fetchMock.mockImplementation(respondWith(OVERVIEW, [session]));

    const actor = userEvent.setup();
    render(<AdminArea initialPanel="activity" />);

    await actor.click(await screen.findByRole('button', { name: /Stop/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/sessions/tab-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('lists the library roots', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));

    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText(/\/media\/movies/)).toBeInTheDocument();
  });

  it("opens a library's settings from its name", async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await chooseLibrary(actor, 'Movies', /Library settings/);

    expect(await screen.findByRole('dialog', { name: 'Movies settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Force default audio track' })).toBeInTheDocument();
  });

  it('adds a library from the dialog', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Add library' }));

    const dialog = screen.getByRole('dialog', { name: 'Add a library' });

    await actor.type(within(dialog).getByLabelText('Name'), 'Shows');
    await actor.type(within(dialog).getByLabelText('Path'), '/media/shows');
    await actor.click(within(dialog).getByRole('button', { name: 'Add library' }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });

    expect(screen.getByText('Shows')).toBeInTheDocument();
  });

  it('scans a library on request', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await chooseLibrary(actor, 'Movies', /Scan for changes/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${MOVIES_LIBRARY_ID}/scan`, {
        method: 'POST',
      });
    });
  });

  it('offers to scan every library at once, forcing a fresh probe of each', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/libraries/${MOVIES_LIBRARY_ID}/scan?force=true`,
        { method: 'POST' },
      );
    });
  });

  it('asks before resetting every library', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Reset and rebuild' }));

    expect(
      await screen.findByRole('dialog', { name: 'Reset and rebuild every library' }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/reset'),
      expect.anything(),
    );
  });

  it('clears and rebuilds every library once the operator confirms', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Reset and rebuild' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Reset and rebuild every library',
    });

    await actor.click(within(dialog).getByRole('button', { name: 'Reset and rebuild' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${MOVIES_LIBRARY_ID}/reset`, {
        method: 'POST',
      });
    });
  });

  it('does nothing when the operator backs out of the reset', async () => {
    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Reset and rebuild' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Reset and rebuild every library',
    });

    await actor.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/reset'),
      expect.anything(),
    );
  });

  it('shows a progress bar in place of the button while a library is scanning', async () => {
    const scanUrl = `/api/libraries/${MOVIES_LIBRARY_ID}/scan`;

    fetchMock.mockImplementation((input: string, init?: RequestInit) =>
      input === scanUrl ? new Promise(() => undefined) : respondWith()(input, init),
    );

    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await chooseLibrary(actor, 'Movies', /Scan for changes/);

    expect(await screen.findByText('Reading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scan' })).not.toBeInTheDocument();
  });

  it('reports how many files have actually been probed as the scan goes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const scanUrl = `/api/libraries/${MOVIES_LIBRARY_ID}/scan`;
    let readings = 0;

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === scanUrl) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobId: 'scan-job', state: 'queued' }),
        });
      }

      if (input.includes('/scans/')) {
        readings += 1;

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              readings === 1
                ? { jobId: 'scan-job', state: 'running', phase: 'probing', processed: 3, total: 10 }
                : {
                    jobId: 'scan-job',
                    state: 'completed',
                    phase: 'previews',
                    processed: 10,
                    total: 10,
                  },
            ),
        });
      }

      return respondWith()(input, init);
    });

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await chooseLibrary(actor, 'Movies', /Scan for changes/);

    expect(await screen.findByText('Reading')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1000);

    await waitFor(() => {
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('moves the label on to the next stage once probing finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const scanUrl = `/api/libraries/${MOVIES_LIBRARY_ID}/scan`;
    let readings = 0;

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === scanUrl) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobId: 'scan-job', state: 'queued' }),
        });
      }

      if (input.includes('/scans/')) {
        readings += 1;

        const reading =
          readings === 1
            ? { jobId: 'scan-job', state: 'running', phase: 'probing', processed: 1, total: 1 }
            : readings === 2
              ? { jobId: 'scan-job', state: 'running', phase: 'previews', processed: 0, total: 1 }
              : {
                  jobId: 'scan-job',
                  state: 'completed',
                  phase: 'previews',
                  processed: 1,
                  total: 1,
                };

        return Promise.resolve({ ok: true, json: () => Promise.resolve(reading) });
      }

      return respondWith()(input, init);
    });

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await chooseLibrary(actor, 'Movies', /Scan for changes/);

    expect(await screen.findByText('Reading')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1000);

    expect(await screen.findByText('Reading')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1000);

    await waitFor(() => {
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('says every library is being read when scanning them all', async () => {
    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === '/api/libraries' && init?.method !== 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(TWO_LIBRARIES) });
      }

      if (input.includes('/scan?force=true')) {
        return new Promise(() => undefined);
      }

      return respondWith()(input, init);
    });

    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }));

    await waitFor(() => {
      expect(screen.getAllByText('Reading').length).toBeGreaterThan(1);
    });
  });

  it('guides the operator when there are no libraries', async () => {
    fetchMock.mockImplementation((input: string, init?: RequestInit) =>
      input.includes('/api/libraries') && init?.method !== 'POST'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        : respondWith()(input, init),
    );

    const actor = userEvent.setup();

    render(<AdminArea />);

    await actor.click(await screen.findByRole('tab', { name: 'Libraries' }));

    expect(await screen.findByText(/No libraries yet/)).toBeInTheDocument();
  });
});
