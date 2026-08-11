import { describe, expect, it } from 'vitest'
import generateTrickplayModule from './generateTrickplay'
import type { TrickplayParams, TrickplayStore } from './generateTrickplay'
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient'

const { generateTrickplay } = generateTrickplayModule

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const PARAMS: TrickplayParams = { intervalSeconds: 10, tileWidth: 160, columns: 8, rows: 8 }

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
}

const stubTranscoder = (requestTrickplay: Transcoder['requestTrickplay']): Transcoder => ({
  isReachable: () => Promise.resolve(true),
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
  capabilities: () => Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
})

const harness = (items: { path: string }[]) => {
  const trickplayRequests: { inputPath: string }[] = []
  const completed: string[] = []
  const withIds = items.map((item, index) => ({ id: `item-${index.toString()}`, ...item }))

  const store: TrickplayStore = {
    listOutstanding: (libraryId) => Promise.resolve(libraryId === LIBRARY_ID ? withIds : []),
    markComplete: (mediaItemId) => {
      completed.push(mediaItemId)

      return Promise.resolve()
    },
  }

  const transcoder = stubTranscoder((request) => {
    trickplayRequests.push(request)

    return Promise.resolve(TRICKPLAY_INDEX)
  })

  return { store, transcoder, trickplayRequests, completed }
}

describe('generateTrickplay', () => {
  it('marks an item done once its sheet has been rendered', async () => {
    const { store, transcoder, completed } = harness([
      { path: '/media/a.mkv' },
      { path: '/media/b.mkv' },
    ])

    await generateTrickplay({ libraryId: LIBRARY_ID, store, transcoder, trickplay: PARAMS })

    expect(completed).toEqual(['item-0', 'item-1'])
  })

  it('does not mark an item whose render failed, so the next run tries again', async () => {
    const completed: string[] = []
    const store: TrickplayStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv' },
          { id: 'b', path: '/media/b.mkv' },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId)

        return Promise.resolve()
      },
    }
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve(TRICKPLAY_INDEX),
    )

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      trickplay: PARAMS,
      onProblem: () => {},
    })

    expect(completed).toEqual(['b'])
  })

  it('does nothing at all when a library has nothing outstanding', async () => {
    const { store, transcoder, trickplayRequests } = harness([])

    await generateTrickplay({ libraryId: LIBRARY_ID, store, transcoder, trickplay: PARAMS })

    expect(trickplayRequests).toEqual([])
  })

  it('re-requests a thumbnail sheet for every stored item', async () => {
    const { store, transcoder, trickplayRequests } = harness([
      { path: '/media/a.mkv' },
      { path: '/media/b.mkv' },
    ])

    await generateTrickplay({ libraryId: LIBRARY_ID, store, transcoder, trickplay: PARAMS })

    expect(trickplayRequests).toMatchObject([
      { inputPath: '/media/a.mkv' },
      { inputPath: '/media/b.mkv' },
    ])
  })

  it('reports progress across the whole library', async () => {
    const { store, transcoder } = harness([{ path: '/media/a.mkv' }, { path: '/media/b.mkv' }])
    const progress: [number, number][] = []

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      trickplay: PARAMS,
      onProgress: (processed, total) => progress.push([processed, total]),
    })

    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
  })

  it('reports a problem for a file that failed rather than stopping the rest', async () => {
    const completed: string[] = []
    const store: TrickplayStore = {
      listOutstanding: () =>
        Promise.resolve([
          { id: 'a', path: '/media/a.mkv' },
          { id: 'b', path: '/media/b.mkv' },
        ]),
      markComplete: (mediaItemId) => {
        completed.push(mediaItemId)

        return Promise.resolve()
      },
    }
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve(TRICKPLAY_INDEX),
    )
    const problems: string[] = []

    await generateTrickplay({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      trickplay: PARAMS,
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    })

    expect(problems).toEqual(['/media/a.mkv: ffmpeg failed'])
  })
})
