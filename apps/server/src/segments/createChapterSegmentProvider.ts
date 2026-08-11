import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaSegment, SegmentKind } from '@FluxContracts/schemas/MediaSegment';

/**
 * What a chapter has to be called for its meaning to be clear.
 *
 * Deliberately narrow. A chapter called "Part 1" might be anything, and
 * guessing wrong hands the viewer a button that skips the opening scene.
 */
const CHAPTER_NAMES: { kind: SegmentKind; patterns: RegExp[] }[] = [
  {
    kind: 'intro',
    patterns: [/^\s*(?:intro|introduction|opening|opening credits|op|theme|titles)\s*$/i],
  },
  { kind: 'recap', patterns: [/^\s*(?:recap|previously(?: on)?|last time)\s*$/i] },
  {
    kind: 'credits',
    patterns: [/^\s*(?:credits|end credits|ending|ed|outro|closing credits)\s*$/i],
  },
  { kind: 'preview', patterns: [/^\s*(?:preview|next episode|next time)\s*$/i] },
];

/**
 * Reads what a chapter's name says it is.
 */
const readChapterKind = (title: string | null): SegmentKind | null =>
  CHAPTER_NAMES.find((entry) => entry.patterns.some((pattern) => pattern.test(title ?? '')))
    ?.kind ?? null;

/**
 * Segments a release already marked.
 *
 * Free and exact: someone sat down and named these, so where a chapter says
 * "Intro" there is nothing to detect. Asked before anything that measures,
 * which is why a season with proper chapters never needs its audio decoded.
 */
const createChapterSegmentProvider = (): SegmentProvider => ({
  name: 'chapters',

  detect: (group: SegmentCandidate[]) => {
    const found = new Map<string, MediaSegment[]>();

    for (const item of group) {
      const segments: MediaSegment[] = [];

      for (const chapter of item.probe.chapters) {
        const kind = readChapterKind(chapter.title);

        if (kind !== null) {
          segments.push({
            kind,
            startSeconds: chapter.startSeconds,
            endSeconds: chapter.endSeconds,
            source: 'chapters',
          });
        }
      }

      if (segments.length > 0) {
        found.set(item.mediaId, segments);
      }
    }

    return Promise.resolve(found);
  },
});

export { createChapterSegmentProvider, readChapterKind, CHAPTER_NAMES };
