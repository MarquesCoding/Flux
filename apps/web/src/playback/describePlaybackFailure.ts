import { z } from 'zod';

const NETWORK = 1;
const MEDIA = 3;
const MANIFEST = 4;
const STREAMING = 5;

const PlaybackEngineErrorSchema = z.object({
  category: z.number().int(),
});

/**
 * Says what went wrong in terms that are true.
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
