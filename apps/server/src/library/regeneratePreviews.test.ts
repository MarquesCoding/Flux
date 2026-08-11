import { describe, expect, it } from 'vitest'
import regeneratePreviewsModule from './regeneratePreviews'
import type { PreviewStore } from './regeneratePreviews'
import type { AudioStream } from '@FluxContracts/schemas/MediaItem'
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient'

const { regeneratePreviews } = regeneratePreviewsModule

const LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const multilingual: AudioStream[] = [
  { index: 1, codec: 'eac3', channels: 6, language: 'deu', isDefault: true, isAtmos: false },
  { index: 2, codec: 'aac', channels: 2, language: 'eng', isDefault: false, isAtmos: false },
]

const stubTranscoder = (requestPreview: Transcoder['requestPreview']): Transcoder => ({
  isReachable: () => Promise.resolve(true),
  probe: () => Promise.reject(new Error('not used')),
  startSession: () => Promise.reject(new Error('not used')),
  readSessionFile: () => Promise.resolve(null),
  readFile: () => Promise.resolve(null),
  sampleColour: () => Promise.reject(new Error('not used')),
  fingerprint: () => Promise.reject(new Error('not used')),
  requestTrickplay: () => Promise.reject(new Error('not used')),
  readTrickplayFile: () => Promise.resolve(null),
  stopSession: () => Promise.resolve(true),
  readSubtitle: () => Promise.reject(new Error('not used')),
  readFrame: () => Promise.reject(new Error('not used')),
  requestPreview,
  readPreviewFile: () => Promise.resolve(null),
  readMonitor: () => Promise.resolve({}),
  openMonitorStream: () => Promise.resolve(null),
  capabilities: () => Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
})

const harness = (items: { path: string; audioStreams: AudioStream[] }[]) => {
  const previewRequests: { inputPath: string; audioStreamIndex?: number }[] = []

  const store: PreviewStore = {
    listForRegeneration: (libraryId) => Promise.resolve(libraryId === LIBRARY_ID ? items : []),
  }

  const transcoder = stubTranscoder((request) => {
    previewRequests.push(request)

    return Promise.resolve({ id: 'p', url: '/p', isReady: true })
  })

  return { store, transcoder, previewRequests }
}

describe('regeneratePreviews', () => {
  it('re-requests a preview for every stored item', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
      { path: '/media/b.mkv', audioStreams: multilingual },
    ])

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
    })

    expect(previewRequests).toMatchObject([
      { inputPath: '/media/a.mkv', audioStreamIndex: 2 },
      { inputPath: '/media/b.mkv', audioStreamIndex: 2 },
    ])
  })

  it('leaves the request untouched when no language is forced', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
    ])

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      defaultAudioLanguage: null,
    })

    expect(previewRequests[0]).not.toHaveProperty('audioStreamIndex')
  })

  it('falls back to the default stream for a file with no matching language', async () => {
    const { store, transcoder, previewRequests } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
    ])

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      defaultAudioLanguage: 'fr',
    })

    expect(previewRequests).toMatchObject([{ audioStreamIndex: 1 }])
  })

  it('reports progress across the whole library', async () => {
    const { store, transcoder } = harness([
      { path: '/media/a.mkv', audioStreams: multilingual },
      { path: '/media/b.mkv', audioStreams: multilingual },
    ])
    const progress: [number, number][] = []

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
      onProgress: (processed, total) => progress.push([processed, total]),
    })

    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
  })

  it('reports a problem for a file that failed rather than stopping the rest', async () => {
    const store: PreviewStore = {
      listForRegeneration: () =>
        Promise.resolve([
          { path: '/media/a.mkv', audioStreams: multilingual },
          { path: '/media/b.mkv', audioStreams: multilingual },
        ]),
    }
    const transcoder = stubTranscoder((request) =>
      request.inputPath === '/media/a.mkv'
        ? Promise.reject(new Error('ffmpeg failed'))
        : Promise.resolve({ id: 'p', url: '/p', isReady: true }),
    )
    const problems: string[] = []

    await regeneratePreviews({
      libraryId: LIBRARY_ID,
      store,
      transcoder,
      defaultAudioLanguage: 'en',
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    })

    expect(problems).toEqual(['/media/a.mkv: ffmpeg failed'])
  })
})
