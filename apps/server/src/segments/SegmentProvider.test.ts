import { describe, expect, it, vi } from 'vitest';
import { isPlausible, resolveSegments } from './SegmentProvider';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';

const EPISODE_SECONDS = 2700;

const intro = (startSeconds: number, endSeconds: number): MediaSegment => ({
  kind: 'intro',
  startSeconds,
  endSeconds,
  source: 'fingerprint',
});

describe('whether a detected range is believable', () => {
  it('refuses a range that ends before it begins', () => {
    expect(isPlausible(intro(120, 60), EPISODE_SECONDS)).toBe(false);
  });

  it('refuses a range of no length at all', () => {
    expect(isPlausible(intro(120, 120), EPISODE_SECONDS)).toBe(false);
  });

  it('refuses a range that begins before the episode does', () => {
    expect(isPlausible(intro(-10, 60), EPISODE_SECONDS)).toBe(false);
  });

  it('refuses a range that runs past the end of the episode', () => {
    expect(isPlausible(intro(60, EPISODE_SECONDS + 30), EPISODE_SECONDS)).toBe(false);
  });

  it('allows a second of slack at the end, since a measurement is not exact', () => {
    expect(isPlausible(intro(EPISODE_SECONDS - 60, EPISODE_SECONDS + 1), EPISODE_SECONDS)).toBe(
      false,
    );
  });

  describe('an intro', () => {
    it('is believable at a minute, a little way in', () => {
      expect(isPlausible(intro(30, 90), EPISODE_SECONDS)).toBe(true);
    });

    it('is not believable at five seconds, which is a coincidence rather than a theme', () => {
      expect(isPlausible(intro(30, 35), EPISODE_SECONDS)).toBe(false);
    });

    it('is not believable at forty minutes, which is most of the episode', () => {
      expect(isPlausible(intro(30, 2430), EPISODE_SECONDS)).toBe(false);
    });

    it('is not believable starting an hour in, which is where credits live', () => {
      expect(isPlausible(intro(2000, 2100), EPISODE_SECONDS)).toBe(false);
    });

    it('is judged the same way when it calls itself a recap', () => {
      expect(
        isPlausible({ kind: 'recap', startSeconds: 30, endSeconds: 90 }, EPISODE_SECONDS),
      ).toBe(true);
    });
  });

  describe('the credits', () => {
    it('are believable at a minute, near the end', () => {
      expect(
        isPlausible({ kind: 'credits', startSeconds: 2500, endSeconds: 2600 }, EPISODE_SECONDS),
      ).toBe(true);
    });

    it('are not believable at ten seconds', () => {
      expect(
        isPlausible({ kind: 'credits', startSeconds: 2500, endSeconds: 2510 }, EPISODE_SECONDS),
      ).toBe(false);
    });

    it('are not believable running for six minutes', () => {
      expect(
        isPlausible({ kind: 'credits', startSeconds: 2200, endSeconds: 2600 }, EPISODE_SECONDS),
      ).toBe(false);
    });

    it('are not believable five minutes into the episode', () => {
      expect(
        isPlausible({ kind: 'credits', startSeconds: 300, endSeconds: 400 }, EPISODE_SECONDS),
      ).toBe(false);
    });
  });

  it('takes a kind it has no rules for at its word', () => {
    expect(
      isPlausible({ kind: 'preview', startSeconds: 10, endSeconds: 20 }, EPISODE_SECONDS),
    ).toBe(true);
  });
});

describe('asking each provider in turn', () => {
  const candidate = (mediaId: string): SegmentCandidate => ({
    mediaId,
    path: `/media/${mediaId}.mkv`,
    durationSeconds: EPISODE_SECONDS,
    probe: {
      container: 'mkv',
      durationSeconds: EPISODE_SECONDS,
      bitrateKbps: 8000,
      video: null,
      audioStreams: [],
      subtitleStreams: [],
      chapters: [],
    },
  });

  const providerNamed = (name: string, detect: SegmentProvider['detect']): SegmentProvider => ({
    name,
    detect,
  });

  it('keeps the first answer for a kind and does not let a later one replace it', async () => {
    const first = providerNamed('chapters', () =>
      Promise.resolve(new Map([['a', [intro(30, 90)]]])),
    );
    const second = providerNamed('fingerprint', () =>
      Promise.resolve(new Map([['a', [intro(40, 100)]]])),
    );

    const { segments } = await resolveSegments([first, second], [candidate('a')]);

    expect(segments.get('a')).toEqual([intro(30, 90)]);
  });

  it('lets a later provider answer for a kind the first said nothing about', async () => {
    const first = providerNamed('chapters', () =>
      Promise.resolve(new Map([['a', [intro(30, 90)]]])),
    );
    const second = providerNamed('fingerprint', () =>
      Promise.resolve(
        new Map([
          [
            'a',
            [
              {
                kind: 'credits' as const,
                startSeconds: 2500,
                endSeconds: 2600,
                source: 'chapters' as const,
              },
            ],
          ],
        ]),
      ),
    );

    const { segments } = await resolveSegments([first, second], [candidate('a')]);

    expect(segments.get('a')).toHaveLength(2);
  });

  it('throws away a range that is not believable rather than recording it', async () => {
    const wild = providerNamed('fingerprint', () =>
      Promise.resolve(new Map([['a', [intro(30, 2600)]]])),
    );

    const { segments } = await resolveSegments([wild], [candidate('a')]);

    expect(segments.get('a')).toBeUndefined();
  });

  it('reports a provider that failed and carries on with the next', async () => {
    const problems: string[] = [];
    const broken = providerNamed('fingerprint', () => Promise.reject(new Error('no audio')));
    const working = providerNamed('chapters', () =>
      Promise.resolve(new Map([['a', [intro(30, 90)]]])),
    );

    const { segments } = await resolveSegments(
      [broken, working],
      [candidate('a')],
      (provider, reason) => {
        problems.push(`${provider}: ${reason}`);
      },
    );

    expect(problems).toEqual(['fingerprint: no audio']);
    expect(segments.get('a')).toEqual([intro(30, 90)]);
  });

  it('says whether anything was actually asked, so nothing is marked done for free', async () => {
    const silent = providerNamed('chapters', () =>
      Promise.resolve(new Map<string, MediaSegment[]>()),
    );

    const { wasAsked } = await resolveSegments([silent], [candidate('a')]);

    expect(wasAsked).toBe(true);
  });

  it('hands a provider the way to report its own progress, since only it knows how far it is', async () => {
    const onItemDone = vi.fn();
    let given: (() => void) | undefined;

    const provider = providerNamed('fingerprint', (_group, reportDone) => {
      given = reportDone;

      return Promise.resolve(new Map<string, MediaSegment[]>());
    });

    await resolveSegments([provider], [candidate('a')], undefined, onItemDone);

    expect(given).toBe(onItemDone);
  });
});
