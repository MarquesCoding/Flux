import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import { findSharedAudio, agreeRange } from '@FluxCore/functions/findSharedAudio';
import { INTRO_BOUNDS } from './SegmentProvider';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';
import type { Range } from '@FluxCore/functions/findSharedAudio';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

const WINDOW_SECONDS = 600;

const MIN_EPISODES = 3;

const MAX_EPISODES = 8;

type CreateFingerprintSegmentProviderOptions = {
  transcoder: Transcoder;
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
};

/**
 * Finds intros and recaps by fingerprinting the audio of several episodes of the same season and
 * looking for the stretch they all share. Slower than reading chapters and available for every file,
 * which is why it is what runs when a file carries no chapters.
 *
 * @param options - The transcoder that fingerprints audio, and how alike two stretches must be.
 * @returns The segment provider.
 */
const createFingerprintSegmentProvider = ({
  transcoder,
  atOnce = 1,
  onProblem,
}: CreateFingerprintSegmentProviderOptions): SegmentProvider => ({
  name: 'fingerprint',

  detect: async (group: SegmentCandidate[], onItemDone?: () => void, owner?: string) => {
    const found = new Map<string, MediaSegment[]>();

    if (group.length < MIN_EPISODES) {
      return found;
    }

    if (!(await transcoder.isReachable())) {
      throw new Error('The media service is not answering, so nothing can be listened to.');
    }

    const considered = group.slice(0, MAX_EPISODES);

    const listened = await mapWithLimit(considered, atOnce, async (item) => {
      try {
        const printed = await transcoder.fingerprint({
          inputPath: item.path,
          startSeconds: 0,
          durationSeconds: Math.min(WINDOW_SECONDS, Math.floor(item.durationSeconds)),
          ...(owner === undefined ? {} : { owner }),
        });

        return {
          mediaId: item.mediaId,
          hashes: printed.hashes,
          framesPerSecond: printed.framesPerSecond,
        };
      } catch (error) {
        onProblem?.(
          item.path,
          error instanceof Error ? error.message : 'Could not be listened to.',
        );

        return null;
      } finally {
        onItemDone?.();
      }
    });

    const fingerprints = listened.filter(
      (one): one is { mediaId: string; hashes: number[]; framesPerSecond: number } => one !== null,
    );

    if (fingerprints.length < MIN_EPISODES) {
      return found;
    }

    const candidates = new Map<string, Range[]>();

    for (let left = 0; left < fingerprints.length; left += 1) {
      for (let right = left + 1; right < fingerprints.length; right += 1) {
        const first = fingerprints[left];
        const second = fingerprints[right];

        if (first === undefined || second === undefined) {
          continue;
        }

        const shared = findSharedAudio(first.hashes, second.hashes, {
          framesPerSecond: first.framesPerSecond,
          minSeconds: INTRO_BOUNDS.minSeconds,
        });

        if (shared === null) {
          continue;
        }

        candidates.set(first.mediaId, [...(candidates.get(first.mediaId) ?? []), shared.left]);
        candidates.set(second.mediaId, [...(candidates.get(second.mediaId) ?? []), shared.right]);
      }
    }

    for (const [mediaId, ranges] of candidates) {
      if (ranges.length < 2) {
        continue;
      }

      const agreed = agreeRange(ranges);

      if (agreed === null) {
        continue;
      }

      found.set(mediaId, [
        {
          kind: 'intro',
          startSeconds: agreed.startSeconds,
          endSeconds: agreed.endSeconds,
          source: 'fingerprint',
        },
      ]);
    }

    return found;
  },
});

export { createFingerprintSegmentProvider };
