import { describe, expect, it } from 'vitest';
import { regeneratePreviews } from './regeneratePreviews';
import type { PreviewStore } from './regeneratePreviews';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { Transcoder } from '@ValenceServer/transcoder/TranscoderClient';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const multilingual: AudioStream[] = [
  { index: 1, codec: 'eac3', channels: 6, language: 'deu', isDefault: true, isAtmos: false },
  { index: 2, codec: 'aac', channels: 2, language: 'eng', isDefault: false, isAtmos: false },
];

const stubTranscoder = (requestPreview: Transcoder['requestPreview']): Transcoder => ({
  isReachable: () => Promise.resolve(true),
  measureCache: () => Promise.resolve(null),
  sweepPreviews: () => Promise.reject(new Error('not used')),
  forgetPreview: () => Promise.reject(new Error('not used')),
  forgetTrickplay: () => Promise.reject(new Error('not used')),
  sweepTrickplay: () => Promise.reject(new Error('not used')),
  probe: () => Promise.reject(new Error('not used')),
  startSession: () => Promise.reject(new Error('not used')),
  readSessionFile: () => Promise.resolve(null),
  readFile: () => Promise.resolve(null),
  fingerprint: () => Promise.reject(new Error('not used')),
  requestTrickplay: () => Promise.reject(new Error('not used')),
  readTrickplayFile: () => Promise.resolve(null),
  stopSession: () => Promise.resolve(true),
  heartbeatSession: () => Promise.resolve(true),
  readSubtitle: () => Promise.reject(new Error('not used')),
  readFrame: () => Promise.reject(new Error('not used')),
  requestPreview,
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

const harness = (items: { path: string; audioStreams: AudioStream[] }[]) => {
  const previewRequests: { inputPath: string; audioStreamIndex?: number }[] = [];
  const completed: string[] = [];
  const withIds = items.map((item, index) => ({ id: `item-${index.toString()}`, ...item }));

  const store: PreviewStore = {
    listOutstanding: (libraryId) => Promise.resolve(libraryId === LIBRARY_ID ? withIds : []),
    markComplete: (mediaItemId) => {
      completed.push(mediaItemId);

      return Promise.resolve();
    },
  };

  const transcoder = stubTranscoder((request) => {
    previewRequests.push(request);

    return Promise.resolve({ id: 'p', url: '/p', isReady: true });
  });

  return { store, transcoder, previewRequests, completed };
};

describe('regeneratePreviews', () => {
  it('marks an item done once its preview has been rendered', async () => {
    const { store, transcoder, completed } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
      { path: '/media/b.mkv', audioStreams: multilingual },
    ]);

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
    });

    expect(completed).toEqual(['item-0', 'item-1']);
  });

  it('does not mark an item whose render failed, so the next run tries again', async () => {
    const completed: string[] = [];
    const store: PreviewStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv', audioStreams: multilingual },
          { id: 'b', path: '/media/b.mkv', audioStreams: multilingual },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId);

        return Promise.resolve();
      },
    };
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve({ id: 'p', url: '/p', isReady: true }),
    );

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
      onProblem: () => {},
    });

    expect(completed).toEqual(['b']);
  });

  it('does nothing at all when a library has nothing outstanding', async () => {
    const { store, transcoder, previewRequests } = harness([]);

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
    });

    expect(previewRequests).toEqual([]);
  });

  it('re-requests a preview for every stored item', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
      { path: '/media/b.mkv', audioStreams: multilingual },
    ]);

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
    });

    expect(previewRequests).toMatchObject([
      { inputPath: '/media/a.mkv', audioStreamIndex: 2 },
      { inputPath: '/media/b.mkv', audioStreamIndex: 2 },
    ]);
  });

  it('leaves the request untouched when no language is forced', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
    ]);

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
    });

    expect(previewRequests[0]).not.toHaveProperty('audioStreamIndex');
  });

  it('falls back to the default stream for a file with no matching language', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
    ]);

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: 'fr',
    });

    expect(previewRequests).toMatchObject([{ audioStreamIndex: 1 }]);
  });

  it('reports progress across the whole library', async () => {
    const { store, transcoder } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
      { path: '/media/b.mkv', audioStreams: multilingual },
    ]);
    const progress: [number, number][] = [];

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
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
    const store: PreviewStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv', audioStreams: multilingual },
          { id: 'b', path: '/media/b.mkv', audioStreams: multilingual },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId);

        return Promise.resolve();
      },
    };
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve({ id: 'p', url: '/p', isReady: true }),
    );
    const problems: string[] = [];

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    });

    expect(problems).toEqual(['/media/a.mkv: ffmpeg failed']);
  });

  it('renders several at once when told it may', async () => {
    let running = 0;
    let most = 0;
    const items = Array.from({ length: 6 }, () => ({ path: '/a.mkv', audioStreams: [] }));
    const { store } = harness(items);

    const transcoder = stubTranscoder(async () => {
      running += 1;
      most = Math.max(most, running);

      await new Promise((resolve) => setTimeout(resolve, 2));

      running -= 1;

      return { id: 'p', url: '/p', isReady: true };
    });

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
      atOnce: 3,
    });

    expect(most).toBe(3);
  });

  it('renders one at a time when not told otherwise', async () => {
    let running = 0;
    let most = 0;
    const items = Array.from({ length: 4 }, () => ({ path: '/a.mkv', audioStreams: [] }));
    const { store } = harness(items);

    const transcoder = stubTranscoder(async () => {
      running += 1;
      most = Math.max(most, running);

      await new Promise((resolve) => setTimeout(resolve, 2));

      running -= 1;

      return { id: 'p', url: '/p', isReady: true };
    });

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      generation: 0,
      store,
      transcoder,
      defaultAudioLanguage: null,
    });

    expect(most).toBe(1);
  });
});
