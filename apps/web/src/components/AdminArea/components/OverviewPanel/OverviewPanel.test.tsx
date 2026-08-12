import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverviewPanel } from './OverviewPanel';
import type { ActiveSession, AdminOverview, Job, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const PLAN: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: { kind: 'passthrough', reason },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const overview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  users: [{ id: 'usr_1', name: 'Dan', email: 'dan@flux.local', role: 'admin', createdAt: '' }],
  settings: { hasCatalogueKey: true, cookieSecure: true, trustedOrigins: [] },
  transcoder: { isReachable: true, ffmpegVersion: '7.1', hardwareAccels: ['videotoolbox'] },
  library: { itemCount: 10, libraryCount: 1 },
  ...overrides,
});

const monitor = (jobs: Job[] = [], queued = 0): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 1,
    systemMemoryTotalBytes: 10,
    cpuCount: 8,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children: [],
    loadAverage: 0,
  },
  queue: { concurrency: 1, queued, running: 0, jobs },
  sessions: 0,
  logs: [],
});

const library = (overrides: Partial<Library> = {}): Library => ({
  id: 'lib_1',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 42,
  lastScannedAt: new Date().toISOString(),
  ...overrides,
  defaultAudioLanguage: null,
});

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  kind: 'library.scan',
  subject: 'Films',
  state: 'running',
  queuedAtMs: 0,
  startedAtMs: 0,
  finishedAtMs: null,
  detail: null,
  ...overrides,
});

const session = (overrides: Partial<ActiveSession> = {}): ActiveSession => ({
  clientId: 'cli_1',
  profileId: 'prf_1',
  profileName: 'Dan',
  deviceLabel: 'Chrome on macOS',
  connectedAt: 0,
  playback: null,
  ...overrides,
});

const watching = (mode: 'direct' | 'transcode' = 'direct'): ActiveSession =>
  session({
    playback: {
      mediaId: 'med_1',
      mediaTitle: 'Arrival',
      hasPoster: false,
      hasBackdrop: false,
      mode,
      plan: PLAN,
      isPlaying: true,
      pausedByAdmin: false,
      startedAt: 0,
      health: null,
    },
  });

const props = {
  overview: overview(),
  monitor: monitor(),
  libraries: [library()],
  sessions: [],
  history: [],
  onOpenPanel: vi.fn(),
};

/**
 * The card a heading belongs to, so an assertion can be made against one
 * region rather than the whole dashboard — several cards say "Films".
 */
const card = (title: string): HTMLElement => {
  const region = screen.getByRole('heading', { name: title }).closest('section');

  if (!(region instanceof HTMLElement)) {
    throw new Error(`No card titled ${title}`);
  }

  return region;
};

describe('OverviewPanel', () => {
  it('shows every card even on a server with nothing wrong', () => {
    render(<OverviewPanel {...props} />);

    for (const title of ['Watching now', 'Running now', 'Libraries', 'Server']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  describe('watching now', () => {
    it('says when nobody is', () => {
      render(<OverviewPanel {...props} />);

      expect(screen.getByText('Nobody is watching anything.')).toBeInTheDocument();
    });

    it('names what is playing, and who is playing it', () => {
      render(<OverviewPanel {...props} sessions={[watching()]} />);

      const region = card('Watching now');

      expect(within(region).getByText('Arrival')).toBeInTheDocument();
      expect(within(region).getByText(/Dan · Chrome on macOS/)).toBeInTheDocument();
    });

    it('says whether a stream is costing the box anything', () => {
      render(<OverviewPanel {...props} sessions={[watching('transcode')]} />);

      expect(within(card('Watching now')).getByText('Transcode')).toBeInTheDocument();
    });

    it('ignores a session with the app open but nothing playing', () => {
      render(<OverviewPanel {...props} sessions={[session()]} />);

      expect(screen.getByText('Nobody is watching anything.')).toBeInTheDocument();
    });
  });

  describe('running now', () => {
    it('says when nothing is', () => {
      render(<OverviewPanel {...props} />);

      expect(screen.getByText('Nothing is running.')).toBeInTheDocument();
    });

    it('mentions a queue that has not started yet', () => {
      render(<OverviewPanel {...props} monitor={monitor([], 3)} />);

      expect(screen.getByText('Nothing running, 3 waiting.')).toBeInTheDocument();
    });

    it('names what is running', () => {
      render(<OverviewPanel {...props} monitor={monitor([job()])} />);

      const region = card('Running now');

      expect(within(region).getByText('Films')).toBeInTheDocument();
      expect(within(region).getByText('library.scan')).toBeInTheDocument();
    });

    it('leaves finished work to the jobs panel', () => {
      render(<OverviewPanel {...props} monitor={monitor([job({ state: 'finished' })])} />);

      expect(screen.getByText('Nothing is running.')).toBeInTheDocument();
    });
  });

  describe('libraries', () => {
    it('counts what is in each one and when it was last read', () => {
      render(<OverviewPanel {...props} />);

      const region = card('Libraries');

      expect(within(region).getByText('42 items')).toBeInTheDocument();
      expect(within(region).getByText(/Scanned just now/)).toBeInTheDocument();
    });

    it('says when one has never been scanned', () => {
      render(<OverviewPanel {...props} libraries={[library({ lastScannedAt: null })]} />);

      expect(within(card('Libraries')).getByText(/Scanned never/)).toBeInTheDocument();
    });

    it('says when there are none', () => {
      render(<OverviewPanel {...props} libraries={[]} />);

      expect(screen.getByText('No libraries yet.')).toBeInTheDocument();
    });
  });

  describe('server', () => {
    it('reports what the machine and the media service are', () => {
      render(<OverviewPanel {...props} />);

      const region = card('Server');

      expect(within(region).getByText('Up')).toBeInTheDocument();
      expect(within(region).getByText('videotoolbox')).toBeInTheDocument();
      expect(within(region).getByText('8')).toBeInTheDocument();
    });

    it('says None rather than nothing when there is no hardware encoding', () => {
      render(
        <OverviewPanel
          {...props}
          overview={overview({
            transcoder: { isReachable: true, ffmpegVersion: '7.1', hardwareAccels: [] },
          })}
        />,
      );

      expect(within(card('Server')).getByText('None')).toBeInTheDocument();
    });

    it('draws dashes rather than zeroes before anything has loaded', () => {
      render(<OverviewPanel {...props} overview={null} monitor={null} libraries={[]} />);

      expect(within(card('Server')).getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('reaches every panel it points at', async () => {
    const onOpenPanel = vi.fn<(panel: string) => void>();
    const user = userEvent.setup();
    render(<OverviewPanel {...props} onOpenPanel={onOpenPanel} />);

    await user.click(screen.getByRole('button', { name: /All sessions/ }));
    await user.click(screen.getByRole('button', { name: /All jobs/ }));
    await user.click(screen.getByRole('button', { name: /Manage/ }));
    await user.click(screen.getByRole('button', { name: /Settings/ }));

    expect(onOpenPanel.mock.calls.map(([panel]) => panel)).toEqual([
      'activity',
      'jobs',
      'libraries',
      'settings',
    ]);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(OverviewPanel.displayName).toBe('OverviewPanel');
  });
});
