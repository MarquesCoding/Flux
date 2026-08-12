import { selectAudioStream } from '@FluxCore/functions/describeTrack';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';

/**
 * What a preview clip is made from.
 */
type PreviewSubject = {
  path: string;
  audioStreams: AudioStream[];
};

/**
 * The request that addresses an item's preview clip.
 *
 * Every field here is part of the clip's address, so two callers that build this
 * differently are asking about two different clips. That matters most to the
 * sweep: it works out what is still wanted and deletes the rest, so a request it
 * built even slightly differently from the one that made the clip would have it
 * delete previews still in use.
 *
 * `audioStreamIndex` is the field that makes this worth extracting. It appears
 * whenever the library forces an audio language, and which stream that lands on
 * is a real decision rather than a lookup: `selectAudioStream` falls back to the
 * default stream and then to the first, so a forced language the file does not
 * carry still names a stream rather than leaving the choice to ffmpeg. Two
 * callers reproducing that separately would eventually disagree, and the one
 * that disagrees while deleting is the sweep.
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

export type { PreviewSubject };

export { previewRequestFor };
