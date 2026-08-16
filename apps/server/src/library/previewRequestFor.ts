import { selectAudioStream } from '@FluxCore/functions/describeTrack';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';

type PreviewSubject = {
  path: string;
  audioStreams: AudioStream[];
};

/**
 * Builds the request that names an item's hover preview, which is also what identifies it in the
 * cache — the same item asked for twice must produce the same request, or the second ask renders a
 * second copy of a clip that already exists.
 *
 * @param item - The item being previewed, with the streams a clip is cut from.
 * @param defaultAudioLanguage - The language the library prefers, which decides the audio track.
 * @returns The request to hand the media service.
 */
const previewRequestFor = (
  subject: PreviewSubject,
  generation: number,
  defaultAudioLanguage: string | null,
): { inputPath: string; generation: number; audioStreamIndex?: number } => {
  const audioStreamIndex =
    defaultAudioLanguage === null
      ? undefined
      : selectAudioStream(subject.audioStreams, defaultAudioLanguage)?.index;

  return {
    inputPath: subject.path,
    generation,
    ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
  };
};

export { previewRequestFor };
