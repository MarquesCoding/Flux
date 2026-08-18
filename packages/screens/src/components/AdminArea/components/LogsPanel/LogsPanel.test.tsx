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

  it('says when it happened, in the reader s own time', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    const local = new Date(Date.UTC(2026, 7, 17, 2, 30, 45));

    expect(
      await screen.findByText(new RegExp(`${local.getHours().toString().padStart(2, '0')}:30:45`)),
    ).toBeInTheDocument();
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
    await actor.click(screen.getByRole('button', { name: /Copy what is shown/ }));

    await waitFor(() => {
      expect(world.copied[0]).toContain('could not read the file');
    });
  });

  it('hands over a file when asked to download', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');
    await actor.click(screen.getByRole('button', { name: /Download what is shown/ }));

    expect(world.downloaded[0]?.name).toBe('flux-log.txt');
  });

  it('says how many times a repeat happened rather than listing it again', async () => {
    const world = build([aRecord({ count: 4000 })]);

    render(<LogsPanel {...world.props} />);

    expect(await screen.findByText('×4000')).toBeInTheDocument();
  });

  it('shows the level and the source as columns of the table', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    expect(screen.getByRole('columnheader', { name: /Level/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Source/ })).toBeInTheDocument();
  });

  it('asks for every level, since the table is what narrows them now', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);

    await waitFor(() => {
      expect(world.asked[0]?.levels).toContain('info');
    });
  });

  it('pages rather than putting hundreds of rows on one screen', async () => {
    const many: LogRecord[] = [];

    for (let index = 0; index < 40; index += 1) {
      many.push(
        aRecord({ id: `record-${index.toString()}`, message: `problem ${index.toString()}` }),
      );
    }
    const world = build(many);

    render(<LogsPanel {...world.props} />);
    await screen.findByText('problem 0');

    expect(screen.queryByText('problem 39')).not.toBeInTheDocument();
  });

  it('opens a record when its row is chosen, so a long message is read whole', async () => {
    const actor = userEvent.setup();
    const world = build([aRecord({ detail: 'at readFile()\nat scanLibrary()' })]);

    render(<LogsPanel {...world.props} />);
    await actor.click(await screen.findByText('could not read the file'));

    expect(await screen.findByText(/at scanLibrary\(\)/)).toBeInTheDocument();
  });

  it('shows the context of the record it opened', async () => {
    const actor = userEvent.setup();
    const world = build([
      aRecord({ context: { ...aRecord().context, jobId: 'job-1', jobKind: 'scan' } }),
    ]);

    render(<LogsPanel {...world.props} />);
    await actor.click(await screen.findByText('could not read the file'));

    expect(await screen.findByText('job-1')).toBeInTheDocument();
  });

  it('follows without being asked, since nothing turns it on', async () => {
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    expect(world.watching()).toBe(1);
  });

  it('reads again when asked to refresh', async () => {
    const actor = userEvent.setup();
    const world = build();

    render(<LogsPanel {...world.props} />);
    await screen.findByText('could not read the file');

    const before = world.asked.length;

    await actor.click(screen.getByRole('button', { name: /Read the log again/ }));

    await waitFor(() => {
      expect(world.asked.length).toBeGreaterThan(before);
    });
  });
});

vi.mock('@FluxClient/realtime/getRealtimeClient', () => ({
  getRealtimeClient: () => ({
    start: () => {},
    stop: () => {},
    subscribe: () => () => {},
    identify: () => {},
    onResumed: () => () => {},
    isLive: () => true,
  }),
}));
