import { describe, expect, it, vi } from 'vitest';
import { detectLibrarySegments, groupBySeason } from './detectLibrarySegments';
import { createMemorySegmentService } from './createMemorySegmentService';
import type { GroupedCandidate } from './detectLibrarySegments';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

const LIBRARY_ID = 'library-1';

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 1440,
  bitrateKbps: 4000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
};

const episode = (
  mediaId: string,
  seriesId: string | null,
  seasonNumber: number | null,
  isComplete = false,
): GroupedCandidate => ({
  mediaId,
  path: `/media/${mediaId}.mkv`,
  probe,
  durationSeconds: 1440,
  seriesId,
  seasonNumber,
  isComplete,
});

const intro: MediaSegment = {
  kind: 'intro',
  startSeconds: 30,
  endSeconds: 120,
  source: 'chapters',
};

const providerThat = (
  detect: (group: SegmentCandidate[]) => Map<string, MediaSegment[]>,
  name = 'test',
): SegmentProvider => ({
  name,
  detect: (group) => Promise.resolve(detect(group)),
});

/**
 * A provider that reports each item as it finishes with it, the way
 * fingerprinting does.
 */
const providerThatTicks = (name = 'fingerprint'): SegmentProvider => ({
  name,
  detect: (group, onItemDone) => {
    group.forEach(() => {
      onItemDone?.();
    });

    return Promise.resolve(new Map());
  },
});

describe('groupBySeason', () => {
  it('puts one season together', () => {
    const groups = groupBySeason([
      episode('a', 'Some Show', 1),
      episode('b', 'Some Show', 1),
      episode('c', 'Some Show', 1),
    ]);

    expect(groups.size).toBe(1);
    expect([...groups.values()][0]).toHaveLength(3);
  });

  it('keeps seasons apart, because a theme can be re-recorded between them', () => {
    const groups = groupBySeason([episode('a', 'Some Show', 1), episode('b', 'Some Show', 2)]);

    expect(groups.size).toBe(2);
  });

  it('keeps shows apart', () => {
    const groups = groupBySeason([episode('a', 'Some Show', 1), episode('b', 'Other Show', 1)]);

    expect(groups.size).toBe(2);
  });

  it('keeps two programmes of the same name apart, which a title could not', () => {
    const theOfficeUk = 'series-uk';
    const theOfficeUs = 'series-us';

    const groups = groupBySeason([
      episode('a', theOfficeUk, 1),
      episode('b', theOfficeUk, 1),
      episode('c', theOfficeUs, 1),
      episode('d', theOfficeUs, 1),
    ]);

    expect(groups.size).toBe(2);
    expect([...groups.values()].map((group) => group.length)).toEqual([2, 2]);
  });

  it('still keeps one programme together across a rename, since the id does not move', () => {
    const groups = groupBySeason([episode('a', 'series-1', 1), episode('b', 'series-1', 1)]);

    expect(groups.size).toBe(1);
  });

  it('leaves every film in a group of its own', () => {
    const groups = groupBySeason([episode('a', null, null), episode('b', null, null)]);

    expect(groups.size).toBe(2);
  });
});

describe('detectLibrarySegments', () => {
  it('records what a provider found', async () => {
    const segments = createMemorySegmentService();

    const marked = await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map([['a', [intro]]]))],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    expect(marked).toBe(1);
    await expect(segments.list('a')).resolves.toEqual([intro]);
  });

  it('asks a provider about one season at a time', async () => {
    const seen: number[] = [];
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat((group) => {
          seen.push(group.length);

          return new Map();
        }),
      ],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1),
          episode('b', 'Some Show', 1),
          episode('c', 'Some Show', 2),
        ]),
    });

    expect(seen.sort()).toEqual([1, 2]);
  });

  it('reports progress in episodes rather than seasons, so an uneven season does not look like an equal step', async () => {
    const onProgress = vi.fn();
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map())],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1),
          episode('b', 'Some Show', 1),
          episode('c', 'Some Show', 2),
          episode('d', 'Some Show', 2),
          episode('e', 'Some Show', 2),
        ]),
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(0, 5);
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it('moves the bar as a provider reports each episode, not just once per season', async () => {
    const onProgress = vi.fn();
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThatTicks()],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1),
          episode('b', 'Some Show', 1),
          episode('c', 'Some Show', 1),
        ]),
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(0, 3);
    expect(onProgress).toHaveBeenCalledWith(1, 3);
    expect(onProgress).toHaveBeenCalledWith(2, 3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it('never lets a provider push progress past what a season could actually contain', async () => {
    const onProgress = vi.fn();
    const segments = createMemorySegmentService();

    const overReporting: SegmentProvider = {
      name: 'overzealous',
      detect: (group, onItemDone) => {
        for (let count = 0; count < group.length + 5; count += 1) {
          onItemDone?.();
        }

        return Promise.resolve(new Map());
      },
    };

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [overReporting],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
      onProgress,
    });

    for (const call of onProgress.mock.calls) {
      expect(call[0]).toBeLessThanOrEqual(1);
    }
  });

  it('replaces what was known rather than adding to it', async () => {
    const segments = createMemorySegmentService({ a: [{ ...intro, startSeconds: 999 }] });

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map([['a', [intro]]]))],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    await expect(segments.list('a')).resolves.toEqual([intro]);
  });

  it('prefers what a human named over what a machine measured', async () => {
    const segments = createMemorySegmentService();

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
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    await expect(segments.list('a')).resolves.toEqual([intro]);
  });

  it('carries on when a provider fails', async () => {
    const onProblem = vi.fn();
    const segments = createMemorySegmentService();

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
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
      onProblem,
    });

    expect(onProblem).toHaveBeenCalledWith('broken', 'ffmpeg went away');
    expect(marked).toBe(1);
  });

  it('refuses a range that could not possibly be an intro', async () => {
    const segments = createMemorySegmentService();

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
      markComplete: () => Promise.resolve(),
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    expect(marked).toBe(0);
    await expect(segments.list('a')).resolves.toEqual([]);
  });

  it('leaves a season alone once every episode in it has been listened to', async () => {
    const seen: string[][] = [];
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat((group) => {
          seen.push(group.map((candidate) => candidate.mediaId));

          return new Map();
        }),
      ],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1, true),
          episode('b', 'Some Show', 1, true),
          episode('c', 'Other Show', 1, false),
        ]),
    });

    expect(seen).toEqual([['c']]);
  });

  it('brings a whole season back through when one episode in it is new', async () => {
    const seen: string[][] = [];
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        providerThat((group) => {
          seen.push(group.map((candidate) => candidate.mediaId));

          return new Map();
        }),
      ],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([episode('a', 'Some Show', 1, true), episode('b', 'Some Show', 1, false)]),
    });

    expect(seen).toEqual([['a', 'b']]);
  });

  it('marks every episode of a season it looked at, not only the ones with a segment', async () => {
    const completed: string[] = [];
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map([['a', [intro]]]))],
      segments,
      markComplete: (mediaId) => {
        completed.push(mediaId);

        return Promise.resolve();
      },
      listCandidates: () =>
        Promise.resolve([episode('a', 'Some Show', 1), episode('b', 'Some Show', 1)]),
    });

    expect(completed).toEqual(['a', 'b']);
  });

  it('counts only the outstanding seasons toward progress', async () => {
    const onProgress = vi.fn();
    const segments = createMemorySegmentService();

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map())],
      segments,
      markComplete: () => Promise.resolve(),
      listCandidates: () =>
        Promise.resolve([
          episode('a', 'Some Show', 1, true),
          episode('b', 'Some Show', 1, true),
          episode('c', 'Other Show', 1, false),
        ]),
      onProgress,
    });

    expect(onProgress).toHaveBeenLastCalledWith(1, 1);
  });

  it('records nothing for a library with nothing in it', async () => {
    const segments = createMemorySegmentService();

    await expect(
      detectLibrarySegments({
        libraryId: LIBRARY_ID,
        providers: [providerThat(() => new Map())],
        segments,
        markComplete: () => Promise.resolve(),
        listCandidates: () => Promise.resolve([]),
      }),
    ).resolves.toBe(0);
  });
});

describe('when nothing can be asked', () => {
  it('leaves a season outstanding rather than marking it done', async () => {
    const completed: string[] = [];

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [
        {
          name: 'fingerprint',
          detect: () => Promise.reject(new Error('fetch failed')),
        },
      ],
      segments: createMemorySegmentService(),
      markComplete: (mediaId) => {
        completed.push(mediaId);

        return Promise.resolve();
      },
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    expect(completed).toEqual([]);
  });

  it('still marks a season done when a provider ran and simply found nothing', async () => {
    const completed: string[] = [];

    await detectLibrarySegments({
      libraryId: LIBRARY_ID,
      providers: [providerThat(() => new Map())],
      segments: createMemorySegmentService(),
      markComplete: (mediaId) => {
        completed.push(mediaId);

        return Promise.resolve();
      },
      listCandidates: () => Promise.resolve([episode('a', 'Some Show', 1)]),
    });

    expect(completed).toEqual(['a']);
  });
});
