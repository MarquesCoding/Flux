import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTrickplay } from './generateTrickplay';
import type { TrickplayParams, TrickplayStore } from './generateTrickplay';
import type { Transcoder } from '@ValenceServer/transcoder/TranscoderClient';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const PARAMS: TrickplayParams = { intervalSeconds: 10, tileWidth: 160, columns: 8, rows: 8 };

const TRICKPLAY_INDEX = {
  id: 'idx',
  intervalSeconds: 10,
  tileWidth: 160,
  tileHeight: 90,
  columns: 8,
  rows: 8,
  sheets: [],
  index: '/idx.json',
  isReady: true,
};

const stubTranscoder = (requestTrickplay: Transcoder['requestTrickplay']): Transcoder => ({
  isReachable: () => Promise.resolve(true),
  measureCache: () => Promise.resolve(null),
  sweepPreviews: () => Promise.reject(new Error('not used')),
  forgetPreview: () => Promise.reject(new Error('not used')),
  requestDownload: () => Promise.reject(new Error('not used')),
  readDownloadFile: () => Promise.reject(new Error('not used')),
  stopDownload: () => Promise.reject(new Error('not used')),
  forgetDownload: () => Promise.reject(new Error('not used')),
  forgetTrickplay: () => Promise.reject(new Error('not used')),
  sweepTrickplay: () => Promise.reject(new Error('not used')),
  probe: () => Promise.reject(new Error('not used')),
  startSession: () => Promise.reject(new Error('not used')),
  readSessionFile: () => Promise.resolve(null),
  readFile: () => Promise.resolve(null),
  fingerprint: () => Promise.reject(new Error('not used')),
  requestTrickplay,
  readTrickplayFile: () => Promise.resolve(null),
  stopSession: () => Promise.resolve(true),
  heartbeatSession: () => Promise.resolve(true),
  readSubtitle: () => Promise.reject(new Error('not used')),
  readFrame: () => Promise.reject(new Error('not used')),
  requestPreview: () => Promise.reject(new Error('not used')),
  readPreviewFile: () => Promise.resolve(null),
  readMonitor: () => Promise.resolve({}),
  openMonitorStream: () => Promise.resolve(null),
  capabilities: () =>
    Promise.resolve({
      ffmpegVersion: 'test',
      probeVersion: 1,
      ffmpegSupported: true,
      encoders: [],
      hardwareAccels: [],
      hardwareScalers: [],
      hardwareOverlays: [],
      hardwareToneMaps: [],
      rejected: [],
      toneMapping: 'unavailable' as const,
      canBurnTextSubtitles: true,
      canBurnImageSubtitles: true,
    }),
});

const harness = (items: { path: string }[]) => {
  const trickplayRequests: Parameters<Transcoder['requestTrickplay']>[0][] = [];
  const completed: string[] = [];
  const withIds = items.map((item, index) => ({ id: `item-${index.toString()}`, ...item }));

  const store: TrickplayStore = {
    listOutstanding: (libraryId) => Promise.resolve(libraryId === LIBRARY_ID ? withIds : []),
    markComplete: (mediaItemId) => {
      completed.push(mediaItemId);

      return Promise.resolve();
    },
  };

  const transcoder = stubTranscoder((request) => {
    trickplayRequests.push(request);

    return Promise.resolve(TRICKPLAY_INDEX);
  });

  return { store, transcoder, trickplayRequests, completed };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('generateTrickplay', () => {
  it('marks an item done once its sheet has been rendered', async () => {
    const { store, transcoder, completed } = harness([
      { path: '/media/a.mkv' },
      { path: '/media/b.mkv' },
    ]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(completed).toEqual(['item-0', 'item-1']);
  });

  it('does not mark an item whose render failed, so the next run tries again', async () => {
    const completed: string[] = [];
    const store: TrickplayStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv' },
          { id: 'b', path: '/media/b.mkv' },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId);

        return Promise.resolve();
      },
    };
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve(TRICKPLAY_INDEX),
    );

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
      onProblem: () => {},
    });

    expect(completed).toEqual(['b']);
  });

  it('does nothing at all when a library has nothing outstanding', async () => {
    const { store, transcoder, trickplayRequests } = harness([]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(trickplayRequests).toEqual([]);
  });

  it('re-requests a thumbnail sheet for every stored item', async () => {
    const { store, transcoder, trickplayRequests } = harness([
      { path: '/media/a.mkv' },
      { path: '/media/b.mkv' },
    ]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(trickplayRequests).toMatchObject([
      { inputPath: '/media/a.mkv' },
      { inputPath: '/media/b.mkv' },
    ]);
  });

  it('reports progress across the whole library', async () => {
    const { store, transcoder } = harness([{ path: '/media/a.mkv' }, { path: '/media/b.mkv' }]);
    const progress: [number, number][] = [];

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
      onProgress: (processed, total) => progress.push([processed, total]),
    });

    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('reports a problem for a file that failed rather than stopping the rest', async () => {
    const completed: string[] = [];
    const store: TrickplayStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv' },
          { id: 'b', path: '/media/b.mkv' },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId);

        return Promise.resolve();
      },
    };
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve(TRICKPLAY_INDEX),
    );
    const problems: string[] = [];

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    });

    expect(problems).toEqual(['/media/a.mkv: ffmpeg failed']);
  });

  it('asks the media service to render in the background rather than holding a request open', async () => {
    const { store, transcoder, trickplayRequests } = harness([{ path: '/media/a.mkv' }]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(trickplayRequests.every((request) => request.wait === false)).toBe(true);
  });

  it('asks again until the sheets are ready, and only then marks the item done', async () => {
    vi.useFakeTimers();

    const asked: Parameters<Transcoder['requestTrickplay']>[0][] = [];
    const store: TrickplayStore = {
      listOutstanding: () => Promise.resolve([{ id: 'item-0', path: '/media/a.mkv' }]),
      markComplete: () => Promise.resolve(),
    };
    const completed: string[] = [];
    const transcoder = stubTranscoder((request) => {
      asked.push(request);

      return Promise.resolve({ ...TRICKPLAY_INDEX, isReady: asked.length >= 3 });
    });

    const running = generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store: {
        ...store,
        markComplete: (id) => {
          completed.push(id);

          return Promise.resolve();
        },
      },
      transcoder,
      trickplay: PARAMS,
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await running;

    expect(asked).toHaveLength(3);
    expect(completed).toEqual(['item-0']);
  });

  it('stops asking when the scan is stopped, and leaves the item outstanding', async () => {
    vi.useFakeTimers();

    const completed: string[] = [];
    let asks = 0;
    const transcoder = stubTranscoder(() => {
      asks += 1;

      return Promise.resolve({ ...TRICKPLAY_INDEX, isReady: false });
    });

    const running = generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store: {
        listOutstanding: () => Promise.resolve([{ id: 'item-0', path: '/media/a.mkv' }]),
        markComplete: (id) => {
          completed.push(id);

          return Promise.resolve();
        },
      },
      transcoder,
      trickplay: PARAMS,
      isCancelled: () => asks >= 2,
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await running;

    expect(completed).toEqual([]);
    expect(asks).toBeLessThan(5);
  });

  it('gives up on a render that never finishes rather than asking forever', async () => {
    vi.useFakeTimers();

    const problems: string[] = [];
    const completed: string[] = [];
    const transcoder = stubTranscoder(() =>
      Promise.resolve({ ...TRICKPLAY_INDEX, isReady: false }),
    );

    const running = generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store: {
        listOutstanding: () => Promise.resolve([{ id: 'item-0', path: '/media/a.mkv' }]),
        markComplete: (id) => {
          completed.push(id);

          return Promise.resolve();
        },
      },
      transcoder,
      trickplay: PARAMS,
      onProblem: (_path, reason) => problems.push(reason),
    });

    await vi.advanceTimersByTimeAsync(31 * 60 * 1_000);
    await running;

    expect(completed).toEqual([]);
    expect(problems.join(' ')).toContain('still being drawn');
  });

  it('says which job asked for the sheets, so the media service can name the scan', async () => {
    const { store, transcoder, trickplayRequests } = harness([{ path: '/media/a.mkv' }]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      owner: 'scan-42',
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(trickplayRequests.every((request) => request.owner === 'scan-42')).toBe(true);
  });

  it('asks for nobody where no job asked, which is a player fetching its own', async () => {
    const { store, transcoder, trickplayRequests } = harness([{ path: '/media/a.mkv' }]);

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      trickplay: PARAMS,
    });

    expect(trickplayRequests.every((request) => request.owner === undefined)).toBe(true);
  });
});
