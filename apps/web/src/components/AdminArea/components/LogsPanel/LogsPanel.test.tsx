import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogsPanel } from './LogsPanel';
import type { LogQuery, LogRecord } from '@FluxContracts/schemas/Log';

const aRecord = (over?: Partial<LogRecord>): LogRecord => ({
  id: 'one',
  atMs: Date.UTC(2026, 7, 17, 2, 30, 45),
  level: 'error',
  source: 'scanner',
  message: 'could not read the file',
  detail: null,
  count: 1,
  context: {
    jobId: null,
    jobKind: null,
    libraryId: null,
    mediaId: null,
    sessionId: null,
    requestId: null,
  },
  ...over,
});

const build = (records: LogRecord[] = [aRecord()]) => {
  const asked: Partial<LogQuery>[] = [];
  let announce: ((record: LogRecord) => void) | null = null;
  let watching = 0;

  const copied: string[] = [];
  const downloaded: { name: string; text: string }[] = [];

  const props = {
    read: (query: Partial<LogQuery>) => {
      asked.push(query);

      return Promise.resolve({ records, total: records.length });
    },
    watch: (onRecord: (record: LogRecord) => void) => {
      announce = onRecord;
      watching += 1;

      return () => {
        watching -= 1;
      };
    },
    copy: (text: string) => {
      copied.push(text);

      return Promise.resolve();
    },
    download: (name: string, text: string) => {
      downloaded.push({ name, text });
    },
  };

  return {
    props,
    asked,
    copied,
    downloaded,
    watching: () => watching,
    arrive: (record: LogRecord) => {
      announce?.(record);
    },
  };
};

describe('LogsPanel', () => {
  it('reads the log when it opens', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    expect(await screen.findByText('could not read the file')).toBeInTheDocument();
  });

  it('asks for warnings and errors to begin with, not everything', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    await waitFor(() => {
      expect(world.asked[0]?.levels).toStrictEqual(['warn', 'error']);
    });
  });

  it('says when nothing matched rather than looking broken', async () => {
    const world = build([]);

    render(<LogsPanel {...world.props} />);

    expect(await screen.findByText(/Nothing has been reported/)).toBeInTheDocument();
  });

  it('says when it happened, in the reader s own time', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    const local = new Date(Date.UTC(2026, 7, 17, 2, 30, 45));

    expect(
      await screen.findByText(new RegExp(`${local.getHours().toString().padStart(2, '0')}:30:45`)),
    ).toBeInTheDocument();
  });

  it('asks again with a level the operator turned on', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: 'info' }));

    await waitFor(() => {
      expect(world.asked.at(-1)?.levels).toContain('info');
    });
  });

  it('asks again with a level the operator turned off', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: 'warn' }));

    await waitFor(() => {
      expect(world.asked.at(-1)?.levels).not.toContain('warn');
    });
  });

  it('asks again narrowed to a source', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: 'transcoder' }));

    await waitFor(() => {
      expect(world.asked.at(-1)?.sources).toStrictEqual(['transcoder']);
    });
  });

  it('asks again with what was typed into the search', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.type(screen.getByLabelText('Search the messages'), 'ffmpeg');

    await waitFor(() => {
      expect(world.asked.at(-1)?.search).toBe('ffmpeg');
    });
  });

  it('follows the log as it is written', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    world.arrive(aRecord({ id: 'two', message: 'a fresh problem' }));

    expect(await screen.findByText('a fresh problem')).toBeInTheDocument();
  });

  it('does not show a live record the filters exclude', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    world.arrive(aRecord({ id: 'two', level: 'info', message: 'ordinary chatter' }));

    await waitFor(() => {
      expect(screen.queryByText('ordinary chatter')).not.toBeInTheDocument();
    });
  });

  it('stops following when the operator turns it off', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('switch', { name: /Follow live/ }));

    await waitFor(() => {
      expect(world.watching()).toBe(0);
    });
  });

  it('says whether it is following', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    const following = screen.getByRole('switch', { name: /Follow live/ });

    expect(following).toBeChecked();

    await actor.click(following);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Follow live/ })).not.toBeChecked();
    });
  });

  it('stops watching when the page is left', async () => {
    const world = build();

    const { unmount } = render(<LogsPanel {...world.props} />);

    await screen.findByText('could not read the file');
    unmount();

    expect(world.watching()).toBe(0);
  });

  it('warns about the file paths before anybody exports them', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    expect(await screen.findByText(/file paths/)).toBeInTheDocument();
  });

  it('copies what is on screen', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(world.copied[0]).toContain('could not read the file');
    });
  });

  it('hands over a file when asked to download', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: 'Download' }));

    expect(world.downloaded[0]?.name).toBe('flux-log.txt');
  });

  it('says how many times a repeat happened rather than listing it again', async () => {
    const world = build([aRecord({ count: 4000 })]);

    render(<LogsPanel {...world.props} />);

    expect(await screen.findByText('×4000')).toBeInTheDocument();
  });

  it('opens a record up to show its context', async () => {
    const actor = userEvent.setup();
    const world = build([
      aRecord({ context: { ...aRecord().context, jobId: 'job-1', jobKind: 'scan' } }),
    ]);

    render(<LogsPanel {...world.props} />);
    await actor.click(await screen.findByRole('button', { name: 'More' }));

    expect(screen.getByText('job-1')).toBeInTheDocument();
  });

  it('shows a stack trace whole rather than truncating it', async () => {
    const actor = userEvent.setup();
    const world = build([aRecord({ detail: 'at readFile()\nat scanLibrary()' })]);

    render(<LogsPanel {...world.props} />);
    await actor.click(await screen.findByRole('button', { name: 'More' }));

    expect(screen.getByText(/at scanLibrary\(\)/)).toBeInTheDocument();
  });

  it('offers nothing to open on a record with nothing more to say', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('reads again when asked to refresh', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    const before = world.asked.length;

    await actor.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(world.asked.length).toBeGreaterThan(before);
    });
  });
});

vi.mock('@FluxWeb/realtime/getRealtimeClient', () => ({
  getRealtimeClient: () => ({
    start: () => {},
    stop: () => {},
    subscribe: () => () => {},
    identify: () => {},
    onResumed: () => () => {},
    isLive: () => true,
  }),
}));
