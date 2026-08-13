import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackgroundJobs } from './BackgroundJobs';
import type { Job, Monitor } from '@FluxWeb/admin/fetchAdmin';

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  kind: 'fingerprint',
  subject: 'Ted S01E01.mkv',
  state: 'running',
  queuedAtMs: 0,
  startedAtMs: 0,
  finishedAtMs: null,
  detail: null,
  ...overrides,
});

const monitor = (jobs: Job[]): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 1,
    systemMemoryTotalBytes: 10,
    cpuCount: 4,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 1,
    children: [],
    loadAverage: 0,
    disks: [],
    graphics: null,
  },
  queue: { concurrency: 1, queued: 0, running: jobs.length, jobs },
  sessions: 0,
  logs: [],
  cache: null,
});

describe('BackgroundJobs', () => {
  it('says what work is being done rather than printing the queue’s own word', () => {
    render(<BackgroundJobs monitor={monitor([job()])} />);

    expect(screen.getByText('Comparing episode audio')).toBeInTheDocument();
    expect(screen.queryByText('fingerprint')).not.toBeInTheDocument();
  });

  it('calls the seek-bar strip scrub previews', () => {
    render(<BackgroundJobs monitor={monitor([job({ kind: 'thumbnails' })])} />);

    expect(screen.getByText('Drawing scrub previews')).toBeInTheDocument();
    expect(screen.queryByText('thumbnails')).not.toBeInTheDocument();
  });

  it('names the file being worked on, which is how somebody finds it', () => {
    render(<BackgroundJobs monitor={monitor([job()])} />);

    expect(screen.getByText('Ted S01E01.mkv')).toBeInTheDocument();
  });

  it('shows an unfamiliar kind rather than an empty cell', () => {
    render(<BackgroundJobs monitor={monitor([job({ kind: 'something-new' })])} />);

    expect(screen.getByText('something-new')).toBeInTheDocument();
  });

  it('says the queue is empty rather than drawing a bare table', () => {
    render(<BackgroundJobs monitor={monitor([])} />);

    expect(screen.queryByText('Ted S01E01.mkv')).not.toBeInTheDocument();
  });

  it('tells an operator when the reading could not be had at all', () => {
    render(<BackgroundJobs monitor={null} isUnreachable />);

    expect(screen.queryByText('Comparing episode audio')).not.toBeInTheDocument();
  });
});
