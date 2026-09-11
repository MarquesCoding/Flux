import { selectAudioStream } from '@ValenceCore/functions/describeTrack';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';

type PreviewSubject = {
  path: string;
  audioStreams: AudioStream[];
};

/**
 * Builds the request that names an item's hover preview, which is also what identifies it in the
 * cache — the same item asked for twice must produce the same request, or the second ask renders a
 * second copy of a clip that already exists.
 *
 * @param subject - The item being previewed, with the streams a clip is cut from.
 * @param generation - Which round of previews this is, so that a change of recipe produces a
 *   different request rather than matching the clip already cached.
 * @param defaultAudioLanguage - The language the library prefers, which decides the audio track.
 * @param quality - The preset the server renders previews at, which is part of the clip's address
 *   too, so a clip made at one preset never answers for another.
 * @returns The request to hand the media service.
 */
const previewRequestFor = (
  subject: PreviewSubject,
  generation: number,
  defaultAudioLanguage: string | null,
  quality: PreviewQuality,
): {
  inputPath: string;
  generation: number;
  quality: PreviewQuality;
  audioStreamIndex?: number;
} => {
  const audioStreamIndex =
    defaultAudioLanguage === null
      ? undefined
      : selectAudioStream(subject.audioStreams, defaultAudioLanguage)?.index;

  return {
    inputPath: subject.path,
    generation,
    quality,
    ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
  };
};

export { previewRequestFor };
