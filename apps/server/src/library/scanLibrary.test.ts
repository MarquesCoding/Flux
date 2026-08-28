import { describe, expect, it, vi } from 'vitest';
import { scanLibrary, selectChanged } from './scanLibrary';
import type { MediaRow, ScanPhase, ScannedFile, ScannedItem, StoredItem } from './scanLibrary';
import type { MetadataProvider } from './MetadataProvider';
import type { MediaProbe, Transcoder } from '@ValenceServer/transcoder/TranscoderClient';

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const departed = (path: string): ScannedItem => ({
  itemId: `gone-${path}`,
  title: path,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  year: null,
  posterUrl: null,
  overview: null,
  durationSeconds: null,
  genres: [],
  rating: null,
  quality: null,
});

const probe = (): MediaProbe => ({
  container: 'mkv',
  durationSeconds: 7200,
  bitrateKbps: 12000,
  video: {
    index: 0,
    codec: 'hevc',
    width: 3840,
    height: 2160,
    range: 'HDR10',
    rangeBase: 'HDR10',
    bitrateKbps: 12000,
    bitDepth: 10,
    level: 150,
    frameRate: 23.976,
    isInterlaced: false,
    refFrames: 4,
    pixelAspect: null,
    rotationDegrees: null,
  },
  audioStreams: [
    {
      index: 1,
      codec: 'eac3',
      channels: 6,
      sampleRate: 48000,
      profile: null,
      language: 'eng',
      title: null,
      isDefault: true,
      isAtmos: true,
    },
  ],
  subtitleStreams: [],
  chapters: [],
});

const file = (path: string, overrides: Partial<ScannedFile> = {}): ScannedFile => ({
  path,
  sizeBytes: 1000,
  modifiedAtMs: 1000,
  ...overrides,
});

const stored = (path: string, overrides: Partial<StoredItem> = {}): StoredItem => ({
  path,
  sizeBytes: 1000,
  modifiedAtMs: 1000,
  externalId: null,
  videoBitDepth: 8,
  videoRangeBase: 'HDR10',
  canCopySegments: true,
  probeVersion: 1,
  videoFrameRate: 23.976,
  ...overrides,
});

const harness = (options: {
  found?: ScannedFile[];
  existing?: StoredItem[];
  probeImpl?: (path: string) => Promise<MediaProbe>;
  providers?: MetadataProvider[];
  force?: boolean;
  isPartial?: boolean;
  isCancelled?: () => boolean;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (phase: ScanPhase, processed: number, total: number) => void;
  trickplay?: { intervalSeconds: number; tileWidth: number; columns: number; rows: number };
  overrides?: { path: string; externalId: string; externalKind: 'tv' | 'movie' }[];
  defaultAudioLanguage?: string | null;
}) => {
  const rows: MediaRow[] = [];
  const removedPaths: string[] = [];
  const markScanned = vi.fn(() => Promise.resolve());
  const previewRequests: { inputPath: string; audioStreamIndex?: number }[] = [];

  const transcoder: Transcoder = {
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
    probe: options.probeImpl ?? (() => Promise.resolve(probe())),
    startSession: () =>
      Promise.resolve({ id: 'x', manifest: '/x', encodesVideo: false, reuse: 'none' as const }),
    readSessionFile: () => Promise.resolve(null),
    readFile: () => Promise.resolve(null),
    fingerprint: () => Promise.resolve({ framesPerSecond: 15.625, startSeconds: 0, hashes: [] }),
    requestTrickplay: () =>
      Promise.resolve({
        id: 'thumbs',
        intervalSeconds: 10,
        tileWidth: 320,
        tileHeight: 180,
        columns: 10,
        rows: 10,
        sheets: [],
        isReady: true,
        index: '/trickplay/thumbs/thumbnails.vtt',
      }),
    readTrickplayFile: () => Promise.resolve(null),
    stopSession: () => Promise.resolve(true),
    heartbeatSession: () => Promise.resolve(true),
    readSubtitle: () => Promise.resolve('WEBVTT\n'),
    readFrame: () => Promise.resolve(new ArrayBuffer(0)),
    requestPreview: (request) => {
      previewRequests.push(request);

      return Promise.resolve({ id: 'p', url: '/p', isReady: true });
    },
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
  };

  const run = () =>
    scanLibrary({
      libraryId: LIBRARY_ID,
      root: '/media/films',
      files: { listFiles: () => Promise.resolve(options.found ?? []) },
      store: {
        listStored: () => Promise.resolve(options.existing ?? []),
        upsert: (row) => {
          rows.push(row);

          return Promise.resolve(`item-${rows.length.toString()}`);
        },
        removeByPaths: (_, paths) => {
          removedPaths.push(...paths);

          return Promise.resolve(paths.map((path) => departed(path)));
        },
        listOverrides: () => Promise.resolve(options.overrides ?? []),
        markScanned,
      },
      transcoder,
      ...(options.defaultAudioLanguage === undefined
        ? {}
        : { defaultAudioLanguage: options.defaultAudioLanguage }),
      ...(options.providers === undefined ? {} : { providers: options.providers }),
      ...(options.force === undefined ? {} : { force: options.force }),
      ...(options.isPartial === undefined ? {} : { isPartial: options.isPartial }),
      ...(options.isCancelled === undefined ? {} : { isCancelled: options.isCancelled }),
      ...(options.onProblem === undefined ? {} : { onProblem: options.onProblem }),
      ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
      ...(options.trickplay === undefined ? {} : { trickplay: options.trickplay }),
    });

  return { run, rows, removedPaths, markScanned, previewRequests };
};

describe('a library whose files have gone from under it', () => {
  it('keeps what it held when the root turns up empty, since a share can be unmounted', async () => {
    const { run, removedPaths } = harness({
      found: [],
      existing: [stored('/a.mkv'), stored('/b.mkv')],
    });

    await run();

    expect(removedPaths).toEqual([]);
  });

  it('says why nothing was touched, rather than reporting a scan that did nothing', async () => {
    const problems: string[] = [];

    const { run } = harness({
      found: [],
      existing: [stored('/a.mkv')],
      onProblem: (_path, reason) => {
        problems.push(reason);
      },
    });

    await run();

    expect(problems.join(' ')).toContain('not mounted');
  });

  it('probes again where nobody recorded the colour depth', async () => {
    const { run, rows } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv', { videoBitDepth: null })],
    });

    await run();

    expect(rows.map((row) => row.path)).toEqual(['/a.mkv']);
  });

  it('probes again where nobody recorded what is legible underneath the range', async () => {
    const { run, rows } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv', { videoRangeBase: null })],
    });

    await run();

    expect(rows.map((row) => row.path)).toEqual(['/a.mkv']);
  });

  it('leaves a file alone once its colour depth is known', async () => {
    const { run, rows } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv')],
    });

    await run();

    expect(rows).toEqual([]);
  });

  it('still removes what has gone while other files remain, which is a real deletion', async () => {
    const { run, removedPaths } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv'), stored('/b.mkv')],
    });

    await run();

    expect(removedPaths).toEqual(['/b.mkv']);
  });

  it('leaves an empty library empty rather than complaining about it', async () => {
    const problems: string[] = [];

    const { run, removedPaths } = harness({
      found: [],
      existing: [],
      onProblem: (_path, reason) => {
        problems.push(reason);
      },
    });

    await run();

    expect(removedPaths).toEqual([]);
    expect(problems).toEqual([]);
  });
});

describe('a scan of a few named files, rather than the whole library', () => {
  it('leaves alone everything it was not asked about', async () => {
    const { run, removedPaths } = harness({
      found: [file('/from-s01e01.mkv')],
      existing: [stored('/from-s01e01.mkv'), stored('/parasite.mkv'), stored('/heat.mkv')],
      force: true,
      isPartial: true,
    });

    await run();

    expect(removedPaths).toEqual([]);
  });

  it('still reads the files it was asked about', async () => {
    const { run, rows } = harness({
      found: [file('/from-s01e01.mkv')],
      existing: [stored('/from-s01e01.mkv'), stored('/parasite.mkv')],
      force: true,
      isPartial: true,
    });

    await run();

    expect(rows.map((row) => row.path)).toEqual(['/from-s01e01.mkv']);
  });

  it('deletes what has gone when the listing was the whole library', async () => {
    const { run, removedPaths } = harness({
      found: [file('/from-s01e01.mkv')],
      existing: [stored('/from-s01e01.mkv'), stored('/parasite.mkv')],
      force: true,
    });

    await run();

    expect(removedPaths).toEqual(['/parasite.mkv']);
  });
});

describe('selectChanged', () => {
  it('treats an unseen file as changed', () => {
    const { changed } = selectChanged([file('/a.mkv')], []);

    expect(changed).toHaveLength(1);
  });

  it('leaves an unchanged file alone', () => {
    const { changed } = selectChanged([file('/a.mkv')], [stored('/a.mkv')]);

    expect(changed).toHaveLength(0);
  });

  it('notices a file whose size changed', () => {
    const { changed } = selectChanged([file('/a.mkv', { sizeBytes: 2000 })], [stored('/a.mkv')]);

    expect(changed).toHaveLength(1);
  });

  it('notices a file that was modified', () => {
    const { changed } = selectChanged([file('/a.mkv', { modifiedAtMs: 2000 })], [stored('/a.mkv')]);

    expect(changed).toHaveLength(1);
  });

  it('reports files that are no longer on disk', () => {
    const { missing } = selectChanged([file('/a.mkv')], [stored('/a.mkv'), stored('/gone.mkv')]);

    expect(missing).toEqual(['/gone.mkv']);
  });

  it('reads a file again when the rules that read it last time have changed', () => {
    const { changed } = selectChanged([file('/a.mkv')], [stored('/a.mkv', { probeVersion: 1 })], 2);

    expect(changed).toHaveLength(1);
  });

  it('leaves a file alone when the rules are the ones it was read under', () => {
    const { changed } = selectChanged([file('/a.mkv')], [stored('/a.mkv', { probeVersion: 2 })], 2);

    expect(changed).toHaveLength(0);
  });

  it('reads a file again when nothing recorded which rules read it', () => {
    const { changed } = selectChanged(
      [file('/a.mkv')],
      [stored('/a.mkv', { probeVersion: null })],
      1,
    );

    expect(changed).toHaveLength(1);
  });

  it('leaves the whole library alone when the rules in force are not known', () => {
    const { changed } = selectChanged(
      [file('/a.mkv'), file('/b.mkv')],
      [stored('/a.mkv', { probeVersion: 1 }), stored('/b.mkv', { probeVersion: null })],
    );

    expect(changed).toHaveLength(0);
  });
});

describe('scanLibrary', () => {
  it('adds new media', async () => {
    const { run, rows } = harness({ found: [file('/media/films/Arrival (2016).mkv')] });

    const result = await run();

    expect(result).toMatchObject({ added: 1, updated: 0, removed: 0, failed: 0 });
    expect(rows[0]).toMatchObject({ title: 'Arrival', year: 2016, libraryId: LIBRARY_ID });
  });

  it('ignores files that are not media', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/poster.jpg'), file('/media/films/film.nfo')],
    });

    const result = await run();

    expect(result.added).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it('does not re-probe an unchanged file', async () => {
    const probeSpy = vi.fn(() => Promise.resolve(probe()));
    const { run } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv')],
      probeImpl: probeSpy,
    });

    await run();

    expect(probeSpy).not.toHaveBeenCalled();
  });

  it('counts a re-probed file as updated rather than added', async () => {
    const { run } = harness({
      found: [file('/a.mkv', { sizeBytes: 5000 })],
      existing: [stored('/a.mkv')],
    });

    expect(await run()).toMatchObject({ added: 0, updated: 1 });
  });

  it('removes rows for files that disappeared from a library still holding others', async () => {
    const { run, removedPaths } = harness({
      found: [file('/kept.mkv')],
      existing: [stored('/kept.mkv'), stored('/gone.mkv')],
    });

    expect(await run()).toMatchObject({ removed: 1 });
    expect(removedPaths).toEqual(['/gone.mkv']);
  });

  it('keeps scanning after a file fails to probe', async () => {
    const probeImpl = vi.fn((path: string) =>
      path.includes('broken')
        ? Promise.reject(new Error('moov atom not found'))
        : Promise.resolve(probe()),
    );

    const { run, rows } = harness({
      found: [file('/broken.mkv'), file('/good.mkv')],
      probeImpl,
    });

    const result = await run();

    expect(result).toMatchObject({ added: 1, failed: 1 });
    expect(rows).toHaveLength(1);
  });

  it('reports why a file failed', async () => {
    const problems: string[] = [];

    await scanLibrary({
      libraryId: LIBRARY_ID,
      root: '/media',
      files: { listFiles: () => Promise.resolve([file('/broken.mkv')]) },
      store: {
        listStored: () => Promise.resolve([]),
        upsert: () => Promise.resolve('item-1'),
        removeByPaths: () => Promise.resolve([]),
        markScanned: () => Promise.resolve(),
      },
      transcoder: {
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
        probe: () => Promise.reject(new Error('moov atom not found')),
        startSession: () =>
          Promise.resolve({ id: 'x', manifest: '/x', encodesVideo: false, reuse: 'none' as const }),
        readSessionFile: () => Promise.resolve(null),
        readFile: () => Promise.resolve(null),
        fingerprint: () =>
          Promise.resolve({ framesPerSecond: 15.625, startSeconds: 0, hashes: [] }),
        requestTrickplay: () =>
          Promise.resolve({
            id: 'thumbs',
            intervalSeconds: 10,
            tileWidth: 320,
            tileHeight: 180,
            columns: 10,
            rows: 10,
            sheets: [],
            isReady: true,
            index: '/trickplay/thumbs/thumbnails.vtt',
          }),
        readTrickplayFile: () => Promise.resolve(null),
        stopSession: () => Promise.resolve(true),
        heartbeatSession: () => Promise.resolve(true),
        readSubtitle: () => Promise.resolve('WEBVTT\n'),
        readFrame: () => Promise.resolve(new ArrayBuffer(0)),
        requestPreview: () => Promise.resolve({ id: 'p', url: '/p', isReady: true }),
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
      },
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    });

    expect(problems).toEqual(['/broken.mkv: moov atom not found']);
  });

  it('skips a file with no video stream', async () => {
    const { run, rows } = harness({
      found: [file('/audio-only.mkv')],
      probeImpl: () => Promise.resolve({ ...probe(), video: null }),
    });

    expect(await run()).toMatchObject({ added: 0, failed: 1 });
    expect(rows).toHaveLength(0);
  });

  it('records when the library was scanned', async () => {
    const { run, markScanned } = harness({ found: [] });

    await run();

    expect(markScanned).toHaveBeenCalledOnce();
  });

  it('does not touch the store when nothing is missing', async () => {
    const { run, removedPaths } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv')],
    });

    expect(await run()).toMatchObject({ removed: 0 });
    expect(removedPaths).toHaveLength(0);
  });

  it('lets a provider override the filename title', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      providers: [
        { name: 'plugin', describe: () => Promise.resolve({ title: 'Arrival', year: 2016 }) },
      ],
    });

    await run();

    expect(rows[0]).toMatchObject({ title: 'Arrival', year: 2016 });
  });

  it('tells a provider what a file was already matched to, on a forced rescan', async () => {
    let seenKnownExternalId: string | null | undefined;
    const { run } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      existing: [stored('/media/films/arrival.2016.1080p.mkv', { externalId: '329' })],
      force: true,
      providers: [
        {
          name: 'plugin',
          describe: (facts) => {
            seenKnownExternalId = facts.knownExternalId;
            return Promise.resolve({ title: 'Arrival', year: 2016 });
          },
        },
      ],
    });

    await run();

    expect(seenKnownExternalId).toBe('329');
  });

  it('keeps what a catalogue said before rather than writing a filename over it', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      existing: [stored('/media/films/arrival.2016.1080p.mkv', { externalId: '329' })],
      force: true,
      providers: [
        {
          name: 'filename',
          describe: () => Promise.resolve({ title: 'arrival.2016.1080p', year: null }),
        },
      ],
    });

    const result = await run();

    expect(rows).toHaveLength(0);
    expect(result.failed).toBe(1);
  });

  it('says why it kept what it had, rather than passing over it in silence', async () => {
    const problems: string[] = [];
    const { run } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      existing: [stored('/media/films/arrival.2016.1080p.mkv', { externalId: '329' })],
      force: true,
      providers: [
        {
          name: 'filename',
          describe: () => Promise.resolve({ title: 'arrival.2016.1080p', year: null }),
        },
      ],
      onProblem: (_path, reason) => problems.push(reason),
    });

    await run();

    expect(problems.join(' ')).toContain('catalogue did not answer');
  });

  it('still writes the answer when the catalogue is the one giving it', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      existing: [stored('/media/films/arrival.2016.1080p.mkv', { externalId: '329' })],
      force: true,
      providers: [
        {
          name: 'catalogue',
          describe: () => Promise.resolve({ title: 'Arrival', year: 2016, externalId: '329' }),
        },
      ],
    });

    await run();

    expect(rows).toHaveLength(1);
  });

  it('writes a filename answer for a file nothing had matched before', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/unknown.mkv')],
      providers: [
        { name: 'filename', describe: () => Promise.resolve({ title: 'unknown', year: null }) },
      ],
    });

    await run();

    expect(rows).toHaveLength(1);
  });

  it('tells a provider nothing was known yet for a file never matched before', async () => {
    let seenKnownExternalId: string | null | undefined;
    const { run } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      providers: [
        {
          name: 'plugin',
          describe: (facts) => {
            seenKnownExternalId = facts.knownExternalId;
            return Promise.resolve({ title: 'Arrival', year: 2016 });
          },
        },
      ],
    });

    await run();

    expect(seenKnownExternalId).toBeNull();
  });

  it('counts a file no provider can name as failed rather than storing it blank', async () => {
    const onProblem = vi.fn();
    const { run, rows } = harness({
      found: [file('/media/films/arrival.mkv')],
      providers: [{ name: 'plugin', describe: () => Promise.resolve(null) }],
      onProblem,
    });

    const result = await run();

    expect(result.failed).toBe(1);
    expect(rows).toHaveLength(0);
    expect(onProblem).toHaveBeenCalled();
  });

  it('probes every file again when forced', async () => {
    const probeSpy = vi.fn(() => Promise.resolve(probe()));
    const { run, rows } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      existing: [stored('/a.mkv'), stored('/b.mkv')],
      probeImpl: probeSpy,
      force: true,
    });

    const result = await run();

    expect(probeSpy).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
    expect(result.updated).toBe(2);
  });

  it('still removes files that disappeared when forced', async () => {
    const { run, removedPaths } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv'), stored('/gone.mkv')],
      force: true,
    });

    const result = await run();

    expect(removedPaths).toEqual(['/gone.mkv']);
    expect(result.removed).toBe(1);
  });

  it('reports probing progress against the files it is actually walking, not everything on disk', async () => {
    const onProgress = vi.fn();
    const { run } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      existing: [stored('/a.mkv')],
      onProgress,
    });

    await run();

    expect(onProgress).toHaveBeenCalledWith('probing', 0, 1);
    expect(onProgress).toHaveBeenCalledWith('probing', 1, 1);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('still counts a failed probe toward progress', async () => {
    const onProgress = vi.fn();
    const { run } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      probeImpl: (path) =>
        path === '/a.mkv' ? Promise.reject(new Error('boom')) : Promise.resolve(probe()),
      onProgress,
    });

    await run();

    expect(onProgress).toHaveBeenLastCalledWith('probing', 2, 2);
  });
});

describe('a correction somebody made', () => {
  it('is what the provider is asked about, not what was matched before', async () => {
    let asked: string | null | undefined;
    const { run } = harness({
      found: [file('/media/films/from.s01e01.mkv')],
      existing: [stored('/media/films/from.s01e01.mkv', { externalId: '111' })],
      overrides: [{ path: '/media/films/from.s01e01.mkv', externalId: '222', externalKind: 'tv' }],
      force: true,
      providers: [
        {
          name: 'catalogue',
          describe: (facts) => {
            asked = facts.knownExternalId;

            return Promise.resolve({ title: 'From', year: 2022, externalId: '222' });
          },
        },
      ],
    });

    await run();

    expect(asked).toBe('222');
  });

  it('says which catalogue the id belongs to, since the number alone cannot', async () => {
    let asked: string | undefined;
    const { run } = harness({
      found: [file('/media/films/some.file.mkv')],
      overrides: [{ path: '/media/films/some.file.mkv', externalId: '9', externalKind: 'movie' }],
      providers: [
        {
          name: 'catalogue',
          describe: (facts) => {
            asked = facts.knownExternalKind;

            return Promise.resolve({ title: 'A film', year: 2000, externalId: '9' });
          },
        },
      ],
    });

    await run();

    expect(asked).toBe('movie');
  });

  it('is read again on every scan, which is what makes it outlive one', async () => {
    const seen: (string | null | undefined)[] = [];
    const build = () =>
      harness({
        found: [file('/media/films/a.mkv')],
        overrides: [{ path: '/media/films/a.mkv', externalId: '42', externalKind: 'tv' }],
        force: true,
        providers: [
          {
            name: 'catalogue',
            describe: (facts) => {
              seen.push(facts.knownExternalId);

              return Promise.resolve({ title: 'A', year: 2000, externalId: '42' });
            },
          },
        ],
      });

    await build().run();
    await build().run();

    expect(seen).toEqual(['42', '42']);
  });

  it('leaves a file nobody corrected to whatever it was matched to', async () => {
    let asked: string | null | undefined;
    const { run } = harness({
      found: [file('/media/films/b.mkv')],
      existing: [stored('/media/films/b.mkv', { externalId: '777' })],
      force: true,
      providers: [
        {
          name: 'catalogue',
          describe: (facts) => {
            asked = facts.knownExternalId;

            return Promise.resolve({ title: 'B', year: 2000, externalId: '777' });
          },
        },
      ],
    });

    await run();

    expect(asked).toBe('777');
  });
});

describe('a scan somebody stopped partway', () => {
  it('keeps what it read and deletes nothing', async () => {
    let seen = 0;

    const { run, rows, removedPaths } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      existing: [stored('/gone.mkv')],
      isCancelled: () => {
        seen += 1;

        return seen > 1;
      },
    });

    const result = await run();

    expect(rows.map((row) => row.path)).toEqual(['/a.mkv']);
    expect(removedPaths).toEqual([]);
    expect(result.removed).toBe(0);
  });

  it('leaves the library unscanned so the next scan finishes the job', async () => {
    const { run, markScanned } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      isCancelled: () => true,
    });

    await run();

    expect(markScanned).not.toHaveBeenCalled();
  });

  it('says that it was stopped rather than leaving it to be guessed at', async () => {
    const problems: string[] = [];

    const { run } = harness({
      found: [file('/a.mkv')],
      isCancelled: () => true,
      onProblem: (_path, reason) => {
        problems.push(reason);
      },
    });

    await run();

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('stopped');
  });
});
