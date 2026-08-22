import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JobsPanel } from './JobsPanel';
import type { Job, JobDefinition, Monitor } from '@FluxClient/admin/fetchAdmin';

const definition: JobDefinition = {
  kind: 'library.scan',
  label: 'Scan for changes',
  description: 'Looks for new and changed files.',
  needsLibrary: true,
  destructive: false,
};

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  kind: 'library.scan',
  subject: 'Films',
  state: 'running',
  queuedAtMs: 0,
  detail: null,
  startedAtMs: null,
  finishedAtMs: null,
  ...overrides,
});

const reading = (jobs: Job[], queue: Partial<Monitor['queue']> = {}): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 0,
    systemMemoryTotalBytes: 0,
    cpuCount: 1,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children: [],
    deploymentMemory: null,
    apiMemoryBytes: null,
    loadAverage: 0,
    disks: [],
    graphics: null,
  },
  queue: { concurrency: 2, queued: 0, running: jobs.length, jobs, ...queue },
  sessions: 0,
  logs: [],
  cache: null,
});

const props = {
  definitions: [definition],
  libraries: [],
  progress: new Map(),
  monitor: null,
  viewingJobKind: null,
  schedules: new Map(),
  onRun: vi.fn(),
  onStop: vi.fn(),
  onOpenSchedule: vi.fn(),
  onCloseSchedule: vi.fn(),
  onAddTrigger: vi.fn(),
  onRemoveTrigger: vi.fn(),
};

describe('JobsPanel', () => {
  it('tells failure apart from an empty queue', () => {
    render(<JobsPanel {...props} isUnreachable />);

    expect(screen.getByText(/could not be read from the server/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing queued.')).not.toBeInTheDocument();
  });

  it('says nothing is queued before a reading arrives', () => {
    render(<JobsPanel {...props} />);

    expect(screen.getByText('Nothing queued.')).toBeInTheDocument();
  });

  it('says the same when the queue is empty', () => {
    render(<JobsPanel {...props} monitor={reading([])} />);

    expect(screen.getByText('Nothing queued.')).toBeInTheDocument();
  });

  it('shows what is in the queue', () => {
    render(<JobsPanel {...props} monitor={reading([job()])} />);

    expect(screen.getByText('Films')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('summarises the queue rather than making somebody count', () => {
    render(<JobsPanel {...props} monitor={reading([job()], { queued: 3, running: 1 })} />);

    expect(screen.getByText(/1 running · 3 waiting · 2 at a time/)).toBeInTheDocument();
  });

  it('mentions failures only when there are some', () => {
    render(<JobsPanel {...props} monitor={reading([job()])} />);

    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it('counts failures into the summary when there are', () => {
    render(<JobsPanel {...props} monitor={reading([job({ state: 'failed' })])} />);

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it('says a job is waiting when it has not started', () => {
    render(<JobsPanel {...props} monitor={reading([job({ state: 'queued' })])} />);

    expect(screen.getByText('waiting')).toBeInTheDocument();
  });

  it('reports a short run in milliseconds', () => {
    const startedAtMs = Date.now() - 250;

    render(
      <JobsPanel
        {...props}
        monitor={reading([job({ startedAtMs, finishedAtMs: startedAtMs + 250 })])}
      />,
    );

    expect(screen.getByText('250 ms')).toBeInTheDocument();
  });

  it('reports a longer run in seconds', () => {
    const startedAtMs = Date.now() - 30_000;

    render(
      <JobsPanel
        {...props}
        monitor={reading([job({ startedAtMs, finishedAtMs: startedAtMs + 30_000 })])}
      />,
    );

    expect(screen.getByText('30 s')).toBeInTheDocument();
  });

  it('shows why a job failed', () => {
    render(
      <JobsPanel
        {...props}
        monitor={reading([job({ state: 'failed', detail: 'no such path' })])}
      />,
    );

    expect(screen.getByText('no such path')).toBeInTheDocument();
  });

  describe('opening a schedule', () => {
    it('opens over the list rather than taking its place', () => {
      render(<JobsPanel {...props} viewingJobKind="library.scan" />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Background jobs')).toBeInTheDocument();
    });

    it('stays shut for a job kind it does not know', () => {
      render(<JobsPanel {...props} viewingJobKind="library.summon" />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Background jobs')).toBeInTheDocument();
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(JobsPanel.displayName).toBe('JobsPanel');
  });
});
