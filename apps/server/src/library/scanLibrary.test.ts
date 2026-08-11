import { describe, expect, it, vi } from 'vitest'
import scanLibraryModule from './scanLibrary'
import type { MediaRow, ScannedFile, StoredItem } from './scanLibrary'
import type { MetadataProvider } from './MetadataProvider'
import type { MediaProbe, Transcoder } from '@FluxServer/transcoder/TranscoderClient'

const { scanLibrary, selectChanged } = scanLibraryModule

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

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
    bitrateKbps: 12000,
    bitDepth: 10,
  },
  audioStreams: [
    {
      index: 1,
      codec: 'eac3',
      channels: 6,
      language: 'eng',
      title: null,
      isDefault: true,
      isAtmos: true,
    },
  ],
  subtitleStreams: [],
  chapters: [],
})

const file = (path: string, overrides: Partial<ScannedFile> = {}): ScannedFile => ({
  path,
  sizeBytes: 1000,
  modifiedAtMs: 1000,
  ...overrides,
})

const stored = (path: string, overrides: Partial<StoredItem> = {}): StoredItem => ({
  path,
  sizeBytes: 1000,
  modifiedAtMs: 1000,
  ...overrides,
})

const harness = (options: {
  found?: ScannedFile[]
  existing?: StoredItem[]
  probeImpl?: (path: string) => Promise<MediaProbe>
  providers?: MetadataProvider[]
  force?: boolean
  onProblem?: (path: string, reason: string) => void
  onProgress?: (processed: number, total: number) => void
}) => {
  const rows: MediaRow[] = []
  const removedPaths: string[] = []
  const markScanned = vi.fn(() => Promise.resolve())

  const transcoder: Transcoder = {
    isReachable: () => Promise.resolve(true),
    probe: options.probeImpl ?? (() => Promise.resolve(probe())),
    startSession: () => Promise.resolve({ id: 'x', manifest: '/x' }),
    readSessionFile: () => Promise.resolve(null),
    readFile: () => Promise.resolve(null),
    sampleColour: () => Promise.resolve({ red: 90, green: 60, blue: 140, hex: '#5a3c8c' }),
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
    readSubtitle: () => Promise.resolve('WEBVTT\n'),
    readFrame: () => Promise.resolve(new ArrayBuffer(0)),
    requestPreview: () => Promise.resolve({ id: 'p', url: '/p', isReady: true }),
    readPreviewFile: () => Promise.resolve(null),
    readMonitor: () => Promise.resolve({}),
    openMonitorStream: () => Promise.resolve(null),
    capabilities: () =>
      Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
  }

  const run = () =>
    scanLibrary({
      libraryId: LIBRARY_ID,
      root: '/media/films',
      files: { listFiles: () => Promise.resolve(options.found ?? []) },
      store: {
        listStored: () => Promise.resolve(options.existing ?? []),
        upsert: (row) => {
          rows.push(row)

          return Promise.resolve()
        },
        removeByPaths: (_, paths) => {
          removedPaths.push(...paths)

          return Promise.resolve(paths.length)
        },
        markScanned,
      },
      transcoder,
      ...(options.providers === undefined ? {} : { providers: options.providers }),
      ...(options.force === undefined ? {} : { force: options.force }),
      ...(options.onProblem === undefined ? {} : { onProblem: options.onProblem }),
      ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
    })

  return { run, rows, removedPaths, markScanned }
}

describe('selectChanged', () => {
  it('treats an unseen file as changed', () => {
    const { changed } = selectChanged([file('/a.mkv')], [])

    expect(changed).toHaveLength(1)
  })

  it('leaves an unchanged file alone', () => {
    const { changed } = selectChanged([file('/a.mkv')], [stored('/a.mkv')])

    expect(changed).toHaveLength(0)
  })

  it('notices a file whose size changed', () => {
    const { changed } = selectChanged([file('/a.mkv', { sizeBytes: 2000 })], [stored('/a.mkv')])

    expect(changed).toHaveLength(1)
  })

  it('notices a file that was modified', () => {
    const { changed } = selectChanged([file('/a.mkv', { modifiedAtMs: 2000 })], [stored('/a.mkv')])

    expect(changed).toHaveLength(1)
  })

  it('reports files that are no longer on disk', () => {
    const { missing } = selectChanged([file('/a.mkv')], [stored('/a.mkv'), stored('/gone.mkv')])

    expect(missing).toEqual(['/gone.mkv'])
  })
})

describe('scanLibrary', () => {
  it('adds new media', async () => {
    const { run, rows } = harness({ found: [file('/media/films/Arrival (2016).mkv')] })

    const result = await run()

    expect(result).toMatchObject({ added: 1, updated: 0, removed: 0, failed: 0 })
    expect(rows[0]).toMatchObject({ title: 'Arrival', year: 2016, libraryId: LIBRARY_ID })
  })

  it('ignores files that are not media', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/poster.jpg'), file('/media/films/film.nfo')],
    })

    const result = await run()

    expect(result.added).toBe(0)
    expect(rows).toHaveLength(0)
  })

  it('does not re-probe an unchanged file', async () => {
    const probeSpy = vi.fn(() => Promise.resolve(probe()))
    const { run } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv')],
      probeImpl: probeSpy,
    })

    await run()

    expect(probeSpy).not.toHaveBeenCalled()
  })

  it('counts a re-probed file as updated rather than added', async () => {
    const { run } = harness({
      found: [file('/a.mkv', { sizeBytes: 5000 })],
      existing: [stored('/a.mkv')],
    })

    expect(await run()).toMatchObject({ added: 0, updated: 1 })
  })

  it('removes rows for files that disappeared', async () => {
    const { run, removedPaths } = harness({
      found: [],
      existing: [stored('/gone.mkv')],
    })

    expect(await run()).toMatchObject({ removed: 1 })
    expect(removedPaths).toEqual(['/gone.mkv'])
  })

  it('keeps scanning after a file fails to probe', async () => {
    const probeImpl = vi.fn((path: string) =>
      path.includes('broken')
        ? Promise.reject(new Error('moov atom not found'))
        : Promise.resolve(probe()),
    )

    const { run, rows } = harness({
      found: [file('/broken.mkv'), file('/good.mkv')],
      probeImpl,
    })

    const result = await run()

    expect(result).toMatchObject({ added: 1, failed: 1 })
    expect(rows).toHaveLength(1)
  })

  it('reports why a file failed', async () => {
    const problems: string[] = []

    await scanLibrary({
      libraryId: LIBRARY_ID,
      root: '/media',
      files: { listFiles: () => Promise.resolve([file('/broken.mkv')]) },
      store: {
        listStored: () => Promise.resolve([]),
        upsert: () => Promise.resolve(),
        removeByPaths: () => Promise.resolve(0),
        markScanned: () => Promise.resolve(),
      },
      transcoder: {
        isReachable: () => Promise.resolve(true),
        probe: () => Promise.reject(new Error('moov atom not found')),
        startSession: () => Promise.resolve({ id: 'x', manifest: '/x' }),
        readSessionFile: () => Promise.resolve(null),
        readFile: () => Promise.resolve(null),
        sampleColour: () => Promise.resolve({ red: 90, green: 60, blue: 140, hex: '#5a3c8c' }),
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
        readSubtitle: () => Promise.resolve('WEBVTT\n'),
        readFrame: () => Promise.resolve(new ArrayBuffer(0)),
        requestPreview: () => Promise.resolve({ id: 'p', url: '/p', isReady: true }),
        readPreviewFile: () => Promise.resolve(null),
        readMonitor: () => Promise.resolve({}),
        openMonitorStream: () => Promise.resolve(null),
        capabilities: () =>
          Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
      },
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    })

    expect(problems).toEqual(['/broken.mkv: moov atom not found'])
  })

  it('skips a file with no video stream', async () => {
    const { run, rows } = harness({
      found: [file('/audio-only.mkv')],
      probeImpl: () => Promise.resolve({ ...probe(), video: null }),
    })

    expect(await run()).toMatchObject({ added: 0, failed: 1 })
    expect(rows).toHaveLength(0)
  })

  it('records when the library was scanned', async () => {
    const { run, markScanned } = harness({ found: [] })

    await run()

    expect(markScanned).toHaveBeenCalledOnce()
  })

  it('does not touch the store when nothing is missing', async () => {
    const { run, removedPaths } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv')],
    })

    expect(await run()).toMatchObject({ removed: 0 })
    expect(removedPaths).toHaveLength(0)
  })

  it('lets a provider override the filename title', async () => {
    const { run, rows } = harness({
      found: [file('/media/films/arrival.2016.1080p.mkv')],
      providers: [
        { name: 'plugin', describe: () => Promise.resolve({ title: 'Arrival', year: 2016 }) },
      ],
    })

    await run()

    expect(rows[0]).toMatchObject({ title: 'Arrival', year: 2016 })
  })

  it('counts a file no provider can name as failed rather than storing it blank', async () => {
    const onProblem = vi.fn()
    const { run, rows } = harness({
      found: [file('/media/films/arrival.mkv')],
      providers: [{ name: 'plugin', describe: () => Promise.resolve(null) }],
      onProblem,
    })

    const result = await run()

    expect(result.failed).toBe(1)
    expect(rows).toHaveLength(0)
    expect(onProblem).toHaveBeenCalled()
  })

  it('probes every file again when forced', async () => {
    const probeSpy = vi.fn(() => Promise.resolve(probe()))
    const { run, rows } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      existing: [stored('/a.mkv'), stored('/b.mkv')],
      probeImpl: probeSpy,
      force: true,
    })

    const result = await run()

    expect(probeSpy).toHaveBeenCalledTimes(2)
    expect(rows).toHaveLength(2)
    expect(result.updated).toBe(2)
  })

  it('still removes files that disappeared when forced', async () => {
    const { run, removedPaths } = harness({
      found: [file('/a.mkv')],
      existing: [stored('/a.mkv'), stored('/gone.mkv')],
      force: true,
    })

    const result = await run()

    expect(removedPaths).toEqual(['/gone.mkv'])
    expect(result.removed).toBe(1)
  })

  it('reports progress against the files it is actually walking, not everything on disk', async () => {
    const onProgress = vi.fn()
    const { run } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      existing: [stored('/a.mkv')],
      onProgress,
    })

    await run()

    expect(onProgress).toHaveBeenCalledWith(0, 1)
    expect(onProgress).toHaveBeenCalledWith(1, 1)
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it('still counts a failed probe toward progress', async () => {
    const onProgress = vi.fn()
    const { run } = harness({
      found: [file('/a.mkv'), file('/b.mkv')],
      probeImpl: (path) =>
        path === '/a.mkv' ? Promise.reject(new Error('boom')) : Promise.resolve(probe()),
      onProgress,
    })

    await run()

    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })
})
