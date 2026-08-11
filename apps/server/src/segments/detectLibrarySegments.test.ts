import { describe, expect, it, vi } from 'vitest'
import detectLibrarySegmentsModule from './detectLibrarySegments'
import createMemorySegmentServiceModule from './createMemorySegmentService'
import type { GroupedCandidate } from './detectLibrarySegments'
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider'
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient'
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment'

const { detectLibrarySegments, groupBySeason } = detectLibrarySegmentsModule
const { createMemorySegmentService } = createMemorySegmentServiceModule

const LIBRARY_ID = 'library-1'

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 1440,
  bitrateKbps: 4000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
}

const episode = (
  mediaId: string,
  seriesTitle: string | null,
  seasonNumber: number | null,
): GroupedCandidate => ({
  mediaId,
  path: `/media/${mediaId}.mkv`,
  probe,
  durationSeconds: 1440,
  seriesTitle,
  seasonNumber,
})

const intro: MediaSegment = {
  kind: 'intro',
  startSeconds: 30,
  endSeconds: 120,
  source: 'chapters',
}

const providerThat = (
  detect: (group: SegmentCandidate[]) => Map<string, MediaSegment[]>,
  name = 'test',
): SegmentProvider => ({
  name,
  detect: (group) => Promise.resolve(detect(group)),
})

describe('groupBySeason', () => {
  it('puts one season together', () => {
    const groups = groupBySeason([
      episode('a', 'Some Show', 1),
      episode('b', 'Some Show', 1),
      episode('c', 'Some Show', 1),
    ])

    expect(groups.size).toBe(1)
    expect([...groups.values()][0]).toHaveLength(3)
  })

  it('keeps seasons apart, because a theme can be re-recorded between them', () => {
    const groups = groupBySeason([episode('a', 'Some Show', 1), episode('b', 'Some Show', 2)])

    expect(groups.size).toBe(2)
  })

  it('keeps shows apart', () => {
    const groups = groupBySeason([episode('a', 'Some Show', 1), episode('b', 'Other Show', 1)])

    expect(groups.size).toBe(2)
  })

  it('ignores case in a series name, since releases disagree on it', () => {
    const groups = groupBySeason([episode('a', 'Some Show', 1), episode('b', 'SOME SHOW', 1)])

    expect(groups.size).toBe(1)
  })

  it('leaves every film in a group of its own', () => {
    const groups = groupBySeason([episode('a', null, null), episode('b', null, null)])

    expect(groups.size).toBe(2)
  })
})

describe('detectLibrarySegments', () => {
  it('records what a provider found', async () => {
    const segments = createMemorySegmentService()

    const marked = await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map([['a', [intro]]]))],
      segments,
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    })

    expect(marked).toBe(1)
    await expect(segments.list('a')).resolves.toEqual([intro])
  })

  it('asks a provider about one season at a time', async () => {
    const seen: number[] = []
    const segments = createMemorySegmentService()

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat((group) => {
          seen.push(group.length)

          return new Map()
        }),
      ],
      segments,
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1),
          episode('b', 'Some Show', 1),
          episode('c', 'Some Show', 2),
        ]),
    })

    expect(seen.sort()).toEqual([1, 2])
  })

  it('reports progress in episodes rather than seasons, so an uneven season does not look like an equal step', async () => {
    const onProgress = vi.fn()
    const segments = createMemorySegmentService()

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map())],
      segments,
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1),
          episode('b', 'Some Show', 1),
          episode('c', 'Some Show', 2),
          episode('d', 'Some Show', 2),
          episode('e', 'Some Show', 2),
        ]),
      onProgress,
    })

    // Two seasons, five episodes: a bar counting seasons would say "0 of 2"
    // then "1 of 2" then stop, the same whichever season went first. Counted
    // by episode it grows by however many that season actually had.
    expect(onProgress).toHaveBeenCalledWith(0, 5)
    expect(onProgress).toHaveBeenLastCalledWith(5, 5)
    expect(onProgress).toHaveBeenCalledTimes(3)
  })

  it('replaces what was known rather than adding to it', async () => {
    const segments = createMemorySegmentService({ a: [{ ...intro, startSeconds: 999 }] })

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map([['a', [intro]]]))],
      segments,
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    })

    await expect(segments.list('a')).resolves.toEqual([intro])
  })

  it('prefers what a human named over what a machine measured', async () => {
    const segments = createMemorySegmentService()

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat(() => new Map([['a', [intro]]]), 'chapters'),
        providerThat(
          () =>
            new Map([
              ['a', [{ kind: 'intro', startSeconds: 55, endSeconds: 140, source: 'fingerprint' }]],
            ]),
          'fingerprint',
        ),
      ],
      segments,
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    })

    await expect(segments.list('a')).resolves.toEqual([intro])
  })

  it('carries on when a provider fails', async () => {
    const onProblem = vi.fn()
    const segments = createMemorySegmentService()

    const marked = await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        {
          name: 'broken',
          detect: () => Promise.reject(new Error('ffmpeg went away')),
        },
        providerThat(() => new Map([['a', [intro]]])),
      ],
      segments,
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
      onProblem,
    })

    expect(onProblem).toHaveBeenCalledWith('broken', 'ffmpeg went away')
    expect(marked).toBe(1)
  })

  it('refuses a range that could not possibly be an intro', async () => {
    const segments = createMemorySegmentService()

    const marked = await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat(
          () =>
            new Map([
              ['a', [{ kind: 'intro', startSeconds: 20, endSeconds: 1200, source: 'fingerprint' }]],
            ]),
        ),
      ],
      segments,
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    })

    expect(marked).toBe(0)
    await expect(segments.list('a')).resolves.toEqual([])
  })

  it('records nothing for a library with nothing in it', async () => {
    const segments = createMemorySegmentService()

    await expect(
      detectLibrarySegments({
        libraryId: LIBRARY_ID,
        providers: [providerThat(() => new Map())],
        segments,
        listCandidates: () => Promise.resolve([]),
      }),
    ).resolves.toBe(0)
  })
})
