import { z } from 'zod';

const NETWORK = 1;
const MEDIA = 3;
const MANIFEST = 4;
const STREAMING = 5;

const PlaybackEngineErrorSchema = z.object({
  category: z.number().int(),
});

/**
 * Says what went wrong in terms a viewer can act on — the network, the file, the server — without
 * claiming more than the engine actually reported. A wrong explanation is worse than a vague one:
 * somebody told their connection is at fault will go and restart a router that was working.
 *
 * @param category - The engine's own category for the failure.
 * @returns What to tell the viewer.
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
