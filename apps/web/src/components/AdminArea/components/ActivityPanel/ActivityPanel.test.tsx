import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityPanel } from './ActivityPanel';
import type { ActiveSession, Monitor } from '@FluxWeb/admin/fetchAdmin';

const reading = (children: Monitor['resources']['children'] = [], cpuCount = 4): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 0,
    systemMemoryTotalBytes: 0,
    cpuCount,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children,
    loadAverage: 0,
  },
  queue: { concurrency: 1, queued: 0, running: 0, jobs: [] },
  sessions: 0,
  logs: [],
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

const props = {
  history: [],
  monitor: null,
  sessions: [],
  busyClientId: null,
  onStop: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
};

describe('ActivityPanel', () => {
  it('counts the readings it has, so a flat line is not mistaken for no data', () => {
    render(<ActivityPanel {...props} history={[1, 2, 3]} />);

    expect(screen.getByText('3 readings')).toBeInTheDocument();
  });

  it('says nothing is converting before a reading arrives', () => {
    render(<ActivityPanel {...props} />);

    expect(screen.getByText('Nothing is being converted.')).toBeInTheDocument();
  });

  it('says the same when a reading arrives with no children', () => {
    render(<ActivityPanel {...props} monitor={reading([])} />);

    expect(screen.getByText('Nothing is being converted.')).toBeInTheDocument();
  });

  it('names each conversion by its process, and what it costs', () => {
    render(
      <ActivityPanel
        {...props}
        monitor={reading([{ pid: 4321, cpuPercent: 180, memoryBytes: 1024 * 1024 }])}
      />,
    );

    expect(screen.getByText('ffmpeg 4321')).toBeInTheDocument();
    expect(screen.getByText(/180%/)).toBeInTheDocument();
  });

  it('measures a conversion against every core rather than one', () => {
    render(
      <ActivityPanel
        {...props}
        monitor={reading([{ pid: 1, cpuPercent: 200, memoryBytes: 0 }], 4)}
      />,
    );

    expect(screen.getByRole('presentation')).toHaveStyle({ width: '50%' });
  });

  it('does not draw a bar past its end when a conversion saturates the machine', () => {
    render(
      <ActivityPanel
        {...props}
        monitor={reading([{ pid: 1, cpuPercent: 900, memoryBytes: 0 }], 4)}
      />,
    );

    expect(screen.getByRole('presentation')).toHaveStyle({ width: '100%' });
  });

  it('says when nobody has the app open', () => {
    render(<ActivityPanel {...props} />);

    expect(screen.getByText('Nobody has the app open right now.')).toBeInTheDocument();
  });

  it('groups sessions under the viewer holding them', () => {
    render(<ActivityPanel {...props} sessions={[session(), session({ clientId: 'cli_2' })]} />);

    expect(screen.getAllByRole('heading', { name: 'Dan' })).toHaveLength(1);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ActivityPanel.displayName).toBe('ActivityPanel');
  });
});
