import { selectAudioStream } from '@FluxCore/functions/describeTrack';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';

type PreviewSubject = {
  path: string;
  audioStreams: AudioStream[];
};

/**
 * The request that addresses an item's preview clip.
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
