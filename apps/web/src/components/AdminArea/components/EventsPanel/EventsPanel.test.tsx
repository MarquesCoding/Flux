import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventsPanel } from './EventsPanel';
import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

const reading = (logs: Monitor['logs']): Monitor => ({
  resources: {
    atMs: 0,
    systemCpuPercent: 0,
    systemMemoryUsedBytes: 0,
    systemMemoryTotalBytes: 0,
    cpuCount: 1,
    serviceCpuPercent: 0,
    serviceMemoryBytes: 0,
    children: [],
    loadAverage: 0,
  },
  queue: { concurrency: 1, queued: 0, running: 0, jobs: [] },
  sessions: 0,
  logs,
});

describe('EventsPanel', () => {
  it('says nothing has been reported before a reading arrives', () => {
    render(<EventsPanel monitor={null} />);

    expect(screen.getByText('Nothing has been reported.')).toBeInTheDocument();
  });

  it('says the same when a reading arrives carrying no lines', () => {
    render(<EventsPanel monitor={reading([])} />);

    expect(screen.getByText('Nothing has been reported.')).toBeInTheDocument();
  });

  it('shows what was reported, and where it came from', () => {
    render(
      <EventsPanel
        monitor={reading([{ atMs: 0, level: 'info', source: 'scan', message: 'started' }])}
      />,
    );

    expect(screen.getByText('started')).toBeInTheDocument();
    expect(screen.getByText('scan')).toBeInTheDocument();
  });

  it('marks an error so it is findable in a wall of text', () => {
    render(
      <EventsPanel
        monitor={reading([{ atMs: 0, level: 'error', source: 'scan', message: 'stopped' }])}
      />,
    );

    expect(screen.getByText('scan')).toHaveClass('text-danger');
  });

  it('leaves an ordinary line unmarked', () => {
    render(
      <EventsPanel
        monitor={reading([{ atMs: 0, level: 'info', source: 'scan', message: 'started' }])}
      />,
    );

    expect(screen.getByText('scan')).not.toHaveClass('text-danger');
  });

  it('keeps every line it was given', () => {
    render(
      <EventsPanel
        monitor={reading([
          { atMs: 0, level: 'info', source: 'scan', message: 'started' },
          { atMs: 1, level: 'info', source: 'scan', message: 'finished' },
        ])}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('sets a display name so devtools can identify it', () => {
    expect(EventsPanel.displayName).toBe('EventsPanel');
  });
});
