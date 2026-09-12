import { screen, waitFor, within } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import type { Connect, Handlers } from '@ValenceClient/realtime/createRealtimeClient';
import { useState } from 'react';
import { TabRow } from '@ValenceUI/TabRow';
import { Tabs } from '@ValenceUI/Tabs';
import { ADMIN_PANELS, ADMIN_SECTIONS } from './adminSections';
import { AdminArea } from './AdminArea';
import type { AdminAreaProps } from './AdminArea.types';
import { resetForTests as resetScanCoordinator } from './scanCoordinator';
import type { AdminOverview, Monitor } from '@ValenceClient/admin/fetchAdmin';
import type { Library } from '@ValenceContracts/schemas/Library';
import type { PlaybackPlan, Reason } from '@ValenceContracts/schemas/PlaybackPlan';

const OVERVIEW: AdminOverview = {
  users: [
    {
      id: 'abc',
      name: 'Marques',
      email: 'marques@valence.local',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  settings: {
    hasCatalogueKey: false,
    trustedOrigins: ['http://localhost:5173'],
    cookieSecure: false,
    hardwareAccel: '',
    previewQuality: 'high' as const,
    showsProfilesBeforeSignIn: false,
  },
  transcoder: {
    isReachable: true,
    address: 'unix:/tmp/valence-transcoder.sock',
    ffmpegVersion: '9.0.1',
    ffmpegSupported: true,
    hardwareAccels: ['videotoolbox'],
    rejectedEncoders: [],
    concurrentRenders: 0,
    chains: [],
  },
  library: { itemCount: 15, libraryCount: 2, bytes: 0 },
  artwork: null,
  jobs: { stalled: [] },
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
    deploymentMemory: null,
    apiMemoryBytes: null,
    loadAverage: 1.5,
    disks: [
      { mountPoint: '/', totalBytes: 500 * 1024 ** 3, availableBytes: 100 * 1024 ** 3 },
      { mountPoint: '/media', totalBytes: 8 * 1024 ** 4, availableBytes: 2 * 1024 ** 4 },
    ],
    graphics: { name: 'Apple M5 Pro', encoderPercent: null, devicePercent: 41 },
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
  cache: null,
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

    filesAtOnce: null,
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

  filesAtOnce: null,
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

    filesAtOnce: null,
  },
];

const fetchMock = vi.fn();

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

let listening: Handlers | null = null;

let connections = 0;

/**
 * Stands in for whatever a client connects with, so a test can deliver a reading by hand.
 *
 * @param handlers - What the realtime client wants told about the connection.
 * @returns A link that accepts everything and does nothing with it.
 */
const connect: Connect = (handlers) => {
  listening = handlers;
  connections += 1;

  return { send: () => {}, close: () => {} };
};

const monitorArrives = (reading: JsonValue) => {
  listening?.onMessage(
    JSON.stringify({ kind: 'event', topic: 'monitor', atMs: 1, folded: 0, payload: reading }),
  );
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(respondWith());
  resetScanCoordinator();

  vi.stubGlobal('fetch', fetchMock);

  installPlatform({ ...aFakePlatform(), openSocket: connect });
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

const goTo = async (actor: ReturnType<typeof userEvent.setup>, section: string) => {
  const bar = await screen.findByRole('tablist', { name: 'What to look at' });

  await actor.click(within(bar).getByRole('tab', { name: section }));
};

/**
 * Stands in for the dialog that normally holds which panel is open, so the panels can be drawn on
 * their own.
 *
 * @param panel - The panel to open on.
 * @param onPanel - Told which panel was opened.
 * @param rest - Anything else the area takes.
 * @returns The area, inside a tab root.
 */
const TheAdmin = ({
  panel = 'overview',
  onPanel,
  ...rest
}: { panel?: string; onPanel?: (panel: string) => void } & Omit<
  AdminAreaProps,
  'panel' | 'onPanel'
>) => {
  const [showing, setShowing] = useState<string>(
    () => ADMIN_PANELS.find((one) => one.id === panel)?.id ?? 'overview',
  );

  const move = (next: string) => {
    setShowing(next);
    onPanel?.(next);
  };

  return (
    <Tabs value={showing} onValueChange={move}>
      <TabRow
        tone="underlined"
        groups={ADMIN_SECTIONS.map((section) => ({
          ...(section.label === null ? {} : { label: section.label }),
          items: section.items,
        }))}
        label="What to look at"
        value={showing}
      />

      <AdminArea panel={showing} onPanel={move} {...rest} />
    </Tabs>
  );
};

describe('AdminArea', () => {
  it('keeps the figures worth half an eye on', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('42%')).toBeInTheDocument();
  });

  it('says how much of the busy processor is Valence itself', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('10 cores · Valence 19%')).toBeInTheDocument();
  });

  it('says the graphics figure is the whole card when the encoder cannot be read', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('41%')).toBeInTheDocument();
    expect(await screen.findByText('whole card, not encoder')).toBeInTheDocument();
  });

  it('names the card, and says what it will not say, where there is room for it', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('Apple M5 Pro · encoder not readable')).toBeInTheDocument();
  });

  it('reports room left on the disk the library is on, not on the one Valence boots from', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('2.0 TB free')).toBeInTheDocument();
    expect(await screen.findByText('of 8.0 TB · /media')).toBeInTheDocument();
  });

  it('watches over the one socket rather than a stream of its own', async () => {
    renderInAnAddress(<TheAdmin />);

    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    expect(connections).toBe(1);
  });

  it('follows the machine as it changes', async () => {
    renderInAnAddress(<TheAdmin />);

    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    monitorArrives({
      ...MONITOR,
      resources: { ...MONITOR.resources, systemCpuPercent: 91 },
    });

    expect(await screen.findByText('91%')).toBeInTheDocument();
  });

  it('stops watching once the page is left', async () => {
    const { unmount } = renderInAnAddress(<TheAdmin />);

    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    unmount();
    monitorArrives({ ...MONITOR, resources: { ...MONITOR.resources, systemCpuPercent: 91 } });

    expect(screen.queryByText('91%')).not.toBeInTheDocument();
  });

  it('shows what the media service is working on', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');

    expect(screen.getByText('Parasite (2019).mkv')).toBeInTheDocument();
  });

  it('opens on the panel the address named, so a reload lands back where it was', async () => {
    renderInAnAddress(<TheAdmin panel="jobs" />);

    expect(await screen.findByRole('tab', { name: 'Jobs', selected: true })).toBeInTheDocument();
  });

  it('opens on the overview when the address names no panel', async () => {
    renderInAnAddress(<TheAdmin />);

    expect(await screen.findByText('Load, last minute')).toBeInTheDocument();
  });

  it('falls back to the overview when the address names one it does not have', async () => {
    renderInAnAddress(<TheAdmin panel="not-a-real-panel" />);

    expect(await screen.findByText('Load, last minute')).toBeInTheDocument();
  });

  it('tells the address when the panel changes, so a reload can return to it', async () => {
    const actor = userEvent.setup();
    const onPanel = vi.fn();

    renderInAnAddress(<TheAdmin onPanel={onPanel} />);

    await goTo(actor, 'Jobs');

    expect(onPanel).toHaveBeenCalledWith('jobs');
  });

  it('says why a job failed rather than only that it did', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');

    expect(screen.getAllByText('no such encoder').length).toBeGreaterThan(0);
  });

  it('lets an admin start any job on demand from the Work tab', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');

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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
    await chooseJob(actor, 'Reset and rebuild', /Run now/);

    expect(await screen.findByRole('heading', { name: 'Reset and rebuild?' })).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/jobs/library.reset/run',
      expect.anything(),
    );
  });

  it('opens a job schedule over the list by pressing into its row, not its Run button', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
    await chooseJob(actor, 'Scan for changes', /Edit schedule/);

    const schedule = await screen.findByRole('dialog');

    expect(within(schedule).getByText('Scan for changes')).toBeInTheDocument();
    expect(screen.getAllByText('Scan for changes').length).toBeGreaterThan(1);
  });

  it('adds a trigger to a job from its own schedule page', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Jobs');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Settings');
    await actor.type(screen.getByLabelText('Catalogue key'), 'a-key');
    await actor.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings', expect.anything());
    });
  });

  it('keeps who has an account out of settings, since Accounts is where they live', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Settings');

    expect(await screen.findByText('Signing in')).toBeInTheDocument();
    expect(screen.queryByText('marques@valence.local')).not.toBeInTheDocument();
  });

  it('draws something rather than nothing before the server has answered', () => {
    renderInAnAddress(<TheAdmin />);

    expect(screen.getByText('Processor')).toBeInTheDocument();
  });

  it('says nobody has the app open when nobody does', async () => {
    renderInAnAddress(<TheAdmin panel="activity" />);

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

    renderInAnAddress(<TheAdmin panel="activity" />);

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
    renderInAnAddress(<TheAdmin panel="activity" />);

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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');

    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText(/\/media\/movies/)).toBeInTheDocument();
  });

  it("opens a library's settings from its name", async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
    await chooseLibrary(actor, 'Movies', /Library settings/);

    expect(await screen.findByRole('dialog', { name: 'Movies settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Force default audio track' })).toBeInTheDocument();
  });

  it('adds a library from the dialog', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
    await chooseLibrary(actor, 'Movies', /Scan for changes/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${MOVIES_LIBRARY_ID}/scan`, {
        method: 'POST',
      });
    });
  });

  it('offers to scan every library at once, forcing a fresh probe of each', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/libraries/${MOVIES_LIBRARY_ID}/scan?force=true`),
        { method: 'POST' },
      );
    });
  });

  it('marks every library in one press as the same scan, so it is reported once', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([where]) => String(where).includes('/scan?')).length,
      ).toBeGreaterThan(0);
    });

    const runIds = fetchMock.mock.calls
      .map(([where]) => String(where))
      .filter((where) => where.includes('/scan?'))
      .map((where) => new URL(where, 'http://localhost').searchParams.get('runId'));

    expect(new Set(runIds).size).toBe(1);
    expect(runIds[0]).not.toBeNull();
  });

  it('asks before resetting every library', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');
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

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Libraries');

    expect(await screen.findByText(/No libraries yet/)).toBeInTheDocument();
  });

  describe('the acceleration badge', () => {
    const withAccel = (hardwareAccel: string) =>
      respondWith({ ...OVERVIEW, settings: { ...OVERVIEW.settings, hardwareAccel } });

    it('reports what was found when nobody has insisted', async () => {
      renderInAnAddress(<TheAdmin />);

      expect(await screen.findAllByText('videotoolbox · automatic')).not.toHaveLength(0);
    });

    it('stops claiming hardware once software only is forced', async () => {
      fetchMock.mockImplementation(withAccel('none'));

      renderInAnAddress(<TheAdmin />);

      expect(await screen.findAllByText('Software only · forced')).not.toHaveLength(0);
      expect(screen.queryByText(/videotoolbox/)).not.toBeInTheDocument();
    });

    it('reports the forced backend rather than the automatic pick', async () => {
      fetchMock.mockImplementation(withAccel('nvenc'));

      renderInAnAddress(<TheAdmin />);

      expect(await screen.findAllByText('NVENC · forced')).not.toHaveLength(0);
      expect(screen.queryByText(/videotoolbox/)).not.toBeInTheDocument();
    });
  });
});

describe('steering somebody else’s stream', () => {
  const WATCHING: FakeSession = {
    clientId: 'tab-1',
    profileId: null,
    profileName: 'Dan',
    deviceLabel: 'Chrome on macOS',
    connectedAt: 1,
    playback: {
      mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode: 'direct',
      plan: FAKE_PLAN,
      isPlaying: true,
      pausedByAdmin: false,
      startedAt: 1,
      health: {
        positionSeconds: 42,
        durationSeconds: 7200,
        bufferedAheadSeconds: 12,
        presentedWidth: 1920,
        presentedHeight: 1080,
      },
    },
  };

  const onTheSessionsTab = async (session: FakeSession = WATCHING) => {
    const actor = userEvent.setup();

    fetchMock.mockImplementation(respondWith(OVERVIEW, [session]));

    renderInAnAddress(<TheAdmin />);

    await goTo(actor, 'Sessions');

    return actor;
  };

  it('pauses a stream, and says which tab it paused', async () => {
    const actor = await onTheSessionsTab();

    await actor.click(await screen.findByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/sessions/tab-1/pause',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('lets a paused stream go again', async () => {
    const actor = await onTheSessionsTab({
      ...WATCHING,
      playback: { ...WATCHING.playback!, isPlaying: false, pausedByAdmin: true },
    });

    await actor.click(await screen.findByRole('button', { name: 'Play' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/sessions/tab-1/resume',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('stops a stream outright', async () => {
    const actor = await onTheSessionsTab();

    await actor.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/sessions/tab-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('names what somebody is watching, and on what', async () => {
    await onTheSessionsTab();

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText(/Chrome on macOS/)).toBeInTheDocument();
  });
});
