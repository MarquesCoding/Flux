import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import { findSharedAudio, agreeRange } from '@FluxCore/functions/findSharedAudio';
import { INTRO_BOUNDS } from './SegmentProvider';
import type { SegmentCandidate, SegmentProvider } from './SegmentProvider';
import type { MediaSegment } from '@FluxContracts/schemas/MediaSegment';
import type { Range } from '@FluxCore/functions/findSharedAudio';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

/**
 * How much of each episode is listened to.
 *
 * An intro that has not started within the first ten minutes is not an intro.
 * Listening to a whole episode would multiply the decoding cost by six for
 * nothing.
 */
const WINDOW_SECONDS = 600;

/**
 * The fewest episodes worth comparing.
 *
 * One episode shares nothing with itself that means anything. Two can agree on
 * a coincidence. Three is where agreement starts to be evidence.
 */
const MIN_EPISODES = 3;

/**
 * The most episodes to compare.
 *
 * Comparison is quadratic in the number of episodes, and a theme tune is not
 * more discoverable from twenty examples than from eight.
 */
const MAX_EPISODES = 8;

type CreateFingerprintSegmentProviderOptions = {
  transcoder: Transcoder;
  /**
   * How many episodes to listen to at once. A season is compared as a whole,
   * so this is where the waiting is.
   */
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
};

/**
 * Segments found by listening to a season.
 *
 * Asks whether the media service is there before starting rather than
 * discovering it a file at a time. A season of twelve against a service that
 * has gone away is twelve failures, twelve error lines and twelve waits for a
 * connection that will not open, when one question answers it for all of them.
 *
 * Every pair of episodes is compared, and the longest stretch of audio they
 * have in common is a candidate intro: two episodes of one series share their
 * theme tune and nothing else of any length. A range several pairs independently
 * agree on is kept; a range only one pair found is discarded, because a single
 * pair can agree on a coincidence.
 *
 * Expensive by nature — every episode's audio has to be decoded once — which is
 * why this runs as a background job and why the chapter provider is asked
 * first.
 */
const createFingerprintSegmentProvider = ({
  transcoder,
  atOnce = 1,
  onProblem,
}: CreateFingerprintSegmentProviderOptions): SegmentProvider => ({
  name: 'fingerprint',

  detect: async (group: SegmentCandidate[], onItemDone?: () => void) => {
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

export type { CreateFingerprintSegmentProviderOptions };

export { createFingerprintSegmentProvider, WINDOW_SECONDS, MIN_EPISODES, MAX_EPISODES };
