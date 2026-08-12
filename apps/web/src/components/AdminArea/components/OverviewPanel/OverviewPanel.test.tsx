import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverviewPanel } from './OverviewPanel';
import type { AdminOverview, Job, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';

const overview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  users: [],
  settings: { hasCatalogueKey: true, cookieSecure: true, trustedOrigins: [] },
  transcoder: { isReachable: true, ffmpegVersion: '7.1', hardwareAccels: [] },
  library: { itemCount: 10, libraryCount: 1 },
  ...overrides,
});

const monitor = (jobs: Job[] = []): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 1,
    systemMemoryTotalBytes: 10,
    cpuCount: 4,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children: [],
    loadAverage: 0,
  },
  queue: { concurrency: 1, queued: 0, running: 0, jobs },
  sessions: 0,
  logs: [],
});

const library = (overrides: Partial<Library> = {}): Library => ({
  id: 'lib_1',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 10,
  lastScannedAt: '2026-08-11T00:00:00.000Z',
  ...overrides,
  defaultAudioLanguage: null,
});

const healthy = {
  overview: overview(),
  monitor: monitor(),
  libraries: [library()],
  sessionCount: 0,
  onOpenPanel: vi.fn(),
};

describe('OverviewPanel', () => {
  it('says plainly when nothing needs attention', () => {
    render(<OverviewPanel {...healthy} />);

    expect(screen.getByText('Nothing needs attention.')).toBeInTheDocument();
  });

  it('says whether quiet means idle', () => {
    render(<OverviewPanel {...healthy} />);

    expect(screen.getByText('Nobody is watching anything right now.')).toBeInTheDocument();
  });

  it('counts one viewer without saying "1 people"', () => {
    render(<OverviewPanel {...healthy} sessionCount={1} />);

    expect(screen.getByText('One person is watching.')).toBeInTheDocument();
  });

  it('counts several viewers', () => {
    render(<OverviewPanel {...healthy} sessionCount={3} />);

    expect(screen.getByText('3 people are watching.')).toBeInTheDocument();
  });

  it('reports what is wrong', () => {
    render(
      <OverviewPanel
        {...healthy}
        overview={overview({
          transcoder: { isReachable: false, ffmpegVersion: null, hardwareAccels: [] },
        })}
      />,
    );

    expect(screen.getByText('The media service is unreachable')).toBeInTheDocument();
    expect(screen.queryByText('Nothing needs attention.')).not.toBeInTheDocument();
  });

  it('opens the panel that explains a concern', async () => {
    const onOpenPanel = vi.fn();
    const user = userEvent.setup();

    render(
      <OverviewPanel
        {...healthy}
        libraries={[library({ lastScannedAt: null })]}
        onOpenPanel={onOpenPanel}
      />,
    );

    await user.click(screen.getByRole('button', { name: /never been scanned/ }));

    expect(onOpenPanel).toHaveBeenCalledWith('libraries');
  });

  it('lists every concern rather than only the worst', () => {
    render(
      <OverviewPanel
        {...healthy}
        overview={overview({
          settings: { hasCatalogueKey: false, cookieSecure: true, trustedOrigins: [] },
        })}
        monitor={monitor([
          {
            id: 1,
            kind: 'library.scan',
            subject: 'Films',
            state: 'failed',
            queuedAtMs: 0,
            startedAtMs: 0,
            finishedAtMs: 1,
            detail: null,
          },
        ])}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('says nothing at all before anything has loaded', () => {
    render(<OverviewPanel {...healthy} overview={null} monitor={null} libraries={[]} />);

    expect(screen.getByText('Nothing needs attention.')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(OverviewPanel.displayName).toBe('OverviewPanel');
  });
});
