import { z } from 'zod';

/**
 * The categories the playback engine sorts its failures into.
 *
 * Only the ones Flux tells apart are named. The engine defines others — text,
 * DRM, storage — which say nothing useful to a viewer and fall through to the
 * general case.
 */
const NETWORK = 1;
const MEDIA = 3;
const MANIFEST = 4;
const STREAMING = 5;

/**
 * The part of a playback engine failure Flux reads.
 *
 * Parsed rather than trusted, because it arrives in a `catch` and could be
 * anything the engine or the browser decided to throw.
 */
const PlaybackEngineErrorSchema = z.object({
  category: z.number().int(),
});

/**
 * Says what went wrong in terms that are true.
 *
 * A stream that never arrived and a stream this browser cannot decode reach
 * the player identically, and both used to be reported as the browser's fault.
 * They are not the same thing: when the server's conversion dies, no segments
 * are ever written, and telling the viewer their browser is at fault sends
 * them to fix the one part that was working.
 *
 * A category Flux does not recognise says only that playback failed, rather
 * than guessing at a culprit.
 */
const describePlaybackFailure = (category: number | null): string => {
  if (category === MEDIA) {
    return 'This browser could not decode the stream.';
  }

  if (category === NETWORK || category === MANIFEST || category === STREAMING) {
    return 'The stream did not arrive. The server may have failed to convert this file.';
  }

  return 'The stream could not be played.';
};

export { describePlaybackFailure, PlaybackEngineErrorSchema };
