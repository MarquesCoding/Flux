import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaSegment, SegmentKind } from '@FluxContracts/schemas/MediaSegment';

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
 * Reads what a chapter's own name says it is — an intro, a recap, credits — from the words people
 * put in chapter titles. Where a file carries chapters at all this is free and exact, which is why
 * it is tried before listening to the audio.
 *
 * @param title - The chapter's title as the container gives it.
 * @returns What kind of stretch it is, or null where the name says nothing.
 */
const readChapterKind = (title: string | null): SegmentKind | null =>
  CHAPTER_NAMES.find((entry) => entry.patterns.some((pattern) => pattern.test(title ?? '')))
    ?.kind ?? null;

/**
 * Segments a release already marked.
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

export { createChapterSegmentProvider, readChapterKind };
