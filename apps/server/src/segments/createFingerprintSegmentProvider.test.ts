import { describe, expect, it, vi } from 'vitest'
import { createFingerprintSegmentProvider } from './createFingerprintSegmentProvider'
import type { SegmentCandidate } from './SegmentProvider'
import type { Fingerprint, MediaProbe, Transcoder } from '@FluxServer/transcoder/TranscoderClient'

const FPS = 15.625

/**
 * Hashes decorrelated enough that no two stretches match by accident.
 */
const distinct = (seed: number, count: number): number[] => {
  let state = (seed * 0x9e3779b9) >>> 0

  return Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0

    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return (value ^ (value >>> 14)) >>> 0
  })
}

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 1440,
  bitrateKbps: 4000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
}

const candidate = (index: number): SegmentCandidate => ({
  mediaId: `media-${index.toString()}`,
  path: `/media/Some Show/Season 1/S01E0${index.toString()}.mkv`,
  probe,
  durationSeconds: 1440,
})

/**
 * A season whose episodes open with the same theme.
 *
 * The theme sits at a different offset in each episode, because a cold open is
 * never the same length twice.
 */
const season = (options: {
  episodes: number
  theme?: number[]
  leadIn?: (index: number) => number
}) => {
  const theme = options.theme ?? distinct(1, Math.round(60 * FPS))

  return (path: string): Fingerprint => {
    const index = Number(path.slice(-5, -4))
    const lead = options.leadIn?.(index) ?? index * Math.round(5 * FPS)

    return {
      framesPerSecond: FPS,
      startSeconds: 0,
      hashes: [...distinct(100 + index, lead), ...theme, ...distinct(200 + index, 2000)],
    }
  }
}

const transcoderThat = (
  fingerprint: (path: string) => Fingerprint | Promise<Fingerprint>,
): Transcoder => ({
  isReachable: () => Promise.resolve(true),
  probe: () => Promise.resolve(probe),
  startSession: () => Promise.resolve({ id: 'x', manifest: '/x' }),
  readSessionFile: () => Promise.resolve(null),
  readFile: () => Promise.resolve(null),
  fingerprint: (request) => Promise.resolve(fingerprint(request.inputPath)),
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
      index: '/x',
    }),
  readTrickplayFile: () => Promise.resolve(null),
  stopSession: () => Promise.resolve(true),
  readSubtitle: () => Promise.resolve('WEBVTT\n'),
  readFrame: () => Promise.resolve(new ArrayBuffer(0)),
  requestPreview: () => Promise.resolve({ id: 'p', url: '/p', isReady: true }),
  readPreviewFile: () => Promise.resolve(null),
  readMonitor: () => Promise.resolve({}),
  openMonitorStream: () => Promise.resolve(null),
  capabilities: () => Promise.resolve({ ffmpegVersion: 'test', encoders: [], hardwareAccels: [] }),
})

describe('createFingerprintSegmentProvider', () => {
  it('finds the theme a season has in common', async () => {
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat(season({ episodes: 4 })),
    })

    const found = await provider.detect([candidate(1), candidate(2), candidate(3), candidate(4)])

    expect(found.size).toBe(4)

    const first = found.get('media-1')?.[0]

    expect(first?.kind).toBe('intro')
    expect(first?.source).toBe('fingerprint')
    expect(first?.endSeconds ?? 0 - (first?.startSeconds ?? 0)).toBeGreaterThan(50)
  })

  it('places the theme where it actually sits in each episode', async () => {
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat(season({ episodes: 4 })),
    })

    const found = await provider.detect([candidate(1), candidate(2), candidate(3), candidate(4)])

    // Each episode's cold open is five seconds longer than the last.
    expect(found.get('media-1')?.[0]?.startSeconds).toBeCloseTo(5, 0)
    expect(found.get('media-3')?.[0]?.startSeconds).toBeCloseTo(15, 0)
  })

  it('says nothing about a season whose episodes share nothing', async () => {
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat((path) => ({
        framesPerSecond: FPS,
        startSeconds: 0,
        hashes: distinct(Number(path.slice(-5, -4)) * 31, 3000),
      })),
    })

    const found = await provider.detect([candidate(1), candidate(2), candidate(3)])

    expect(found.size).toBe(0)
  })

  it('refuses to guess from too few episodes', async () => {
    const fingerprint = vi.fn(season({ episodes: 2 }))
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat(fingerprint),
    })

    const found = await provider.detect([candidate(1), candidate(2)])

    expect(found.size).toBe(0)
    expect(fingerprint).not.toHaveBeenCalled()
  })

  it('listens to no more of an episode than an intro could occupy', async () => {
    const paths: number[] = []
    const provider = createFingerprintSegmentProvider({
      transcoder: {
        ...transcoderThat(season({ episodes: 3 })),
        fingerprint: (request) => {
          paths.push(request.durationSeconds)

          return Promise.resolve(season({ episodes: 3 })(request.inputPath))
        },
      },
    })

    await provider.detect([candidate(1), candidate(2), candidate(3)])

    expect(paths.every((seconds) => seconds <= 600)).toBe(true)
  })

  it('carries on when one episode cannot be listened to', async () => {
    const onProblem = vi.fn()
    const answers = season({ episodes: 4 })
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat((path) => {
        if (path.endsWith('2.mkv')) {
          throw new Error('That file has no audio to fingerprint')
        }

        return answers(path)
      }),
      onProblem,
    })

    const found = await provider.detect([candidate(1), candidate(2), candidate(3), candidate(4)])

    expect(onProblem).toHaveBeenCalled()
    expect(found.has('media-1')).toBe(true)
    expect(found.has('media-2')).toBe(false)
  })

  it('reports each episode as its audio is decoded, not just when the season is done', async () => {
    const onItemDone = vi.fn()
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat(season({ episodes: 4 })),
    })

    await provider.detect([candidate(1), candidate(2), candidate(3), candidate(4)], onItemDone)

    expect(onItemDone).toHaveBeenCalledTimes(4)
  })

  it('still reports an episode that could not be listened to', async () => {
    const onItemDone = vi.fn()
    const answers = season({ episodes: 4 })
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat((path) => {
        if (path.endsWith('2.mkv')) {
          throw new Error('That file has no audio to fingerprint')
        }

        return answers(path)
      }),
    })

    await provider.detect([candidate(1), candidate(2), candidate(3), candidate(4)], onItemDone)

    expect(onItemDone).toHaveBeenCalledTimes(4)
  })

  it('reports nothing for a season too small to fingerprint at all', async () => {
    const onItemDone = vi.fn()
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat(season({ episodes: 2 })),
    })

    await provider.detect([candidate(1), candidate(2)], onItemDone)

    expect(onItemDone).not.toHaveBeenCalled()
  })

  it('never compares more episodes than it needs to', async () => {
    const seen: string[] = []
    const answers = season({ episodes: 12 })
    const provider = createFingerprintSegmentProvider({
      transcoder: transcoderThat((path) => {
        seen.push(path)

        return answers(path)
      }),
    })

    await provider.detect(Array.from({ length: 12 }, (_, index) => candidate(index + 1)))

    expect(seen.length).toBeLessThanOrEqual(8)
  })
})
