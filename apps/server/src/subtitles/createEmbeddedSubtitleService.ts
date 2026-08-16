import { describeLanguage, readLanguage } from '@FluxCore/functions/describeTrack';
import { trackId } from './SubtitleService';
import type { SubtitleService, SubtitleTrack } from './SubtitleService';

const HEARING_IMPAIRED_MARKERS = ['sdh', 'cc', 'hearing', 'hard of hearing'];

const NOT_TEXT = new Set(['pgs', 'vobsub', 'dvbsub', 'unknown']);

type EmbeddedStream = {
  index: number;
  format: string;
  language?: string | null | undefined;
  title?: string | null | undefined;
  isForced: boolean;
};

type EmbeddedLookup = {
  find: (mediaId: string) => Promise<{ path: string; streams: EmbeddedStream[] } | null>;
};

type Extractor = {
  readSubtitle: (request: { inputPath: string; streamIndex: number }) => Promise<string>;
};

type CreateEmbeddedSubtitleServiceOptions = {
  media: EmbeddedLookup;
  transcoder: Extractor;
  onProblem?: (path: string, reason: string) => void;
};

/**
 * Names an embedded subtitle track for a menu, from what the container says about it — its
 * language, its own title, and whether it is forced or transcribes the sound.
 *
 * @param stream - The subtitle stream as the file declares it.
 * @param position - Which subtitle track this is, counting from one, for a stream naming nothing.
 * @returns The line to show in a menu.
 */
const describeSubtitle = (stream: EmbeddedStream, position: number): string => {
  const language = describeLanguage(stream.language);
  const title = stream.title?.trim() ?? '';
  const saysLanguage = language !== null && title.toLowerCase().includes(language.toLowerCase());

  const named =
    title === ''
      ? (language ?? `Track ${position.toString()}`)
      : language === null || saysLanguage
        ? title
        : `${language} · ${title}`;

  return stream.isForced && !named.toLowerCase().includes('forced') ? `${named} · Forced` : named;
};

/**
 * Decides whether a track's own title says it transcribes more than the dialogue — the several
 * spellings of SDH and "hearing impaired" that files carry.
 *
 * @param title - The track's title as the container gives it.
 * @returns Whether it claims to transcribe the sound as well.
 */
const marksHearingImpaired = (title: string | null | undefined): boolean => {
  const lowered = (title ?? '').toLowerCase();

  return HEARING_IMPAIRED_MARKERS.some((marker) => lowered.includes(marker));
};

/**
 * Subtitles read out of the video container itself, extracted on demand and converted to the one
 * format a browser will take. Extracting is the expensive part, so each track is cut once and kept.
 *
 * @param options - The library to read files from, and the transcoder that does the extracting.
 * @returns The subtitle service.
 */
const createEmbeddedSubtitleService = ({
  media,
  transcoder,
  onProblem,
}: CreateEmbeddedSubtitleServiceOptions): SubtitleService => {
  const discover = async (mediaId: string) => {
    const found = await media.find(mediaId);

    if (found === null) {
      return null;
    }

    const streams = found.streams.filter((stream) => !NOT_TEXT.has(stream.format));

    return { path: found.path, streams };
  };

  /**
   * Builds the identifier for one embedded stream, so listing the tracks and later fetching one agree
   * on what each is called.
   *
   * @param index - The stream's index inside the container.
   * @returns The track identifier.
   */
  const idFor = (path: string, index: number): string => trackId(`${path}#${index.toString()}`);

  return {
    list: async (mediaId) => {
      const found = await discover(mediaId);

      if (found === null) {
        return null;
      }

      const tracks: SubtitleTrack[] = found.streams.map((stream, position) => ({
        id: idFor(found.path, stream.index),
        language: readLanguage(stream.language),
        label: describeSubtitle(stream, position + 1),
        format: stream.format,
        isForced: stream.isForced,
        isHearingImpaired: marksHearingImpaired(stream.title),
      }));

      return tracks;
    },

    read: async (mediaId, id) => {
      const found = await discover(mediaId);
      const stream = found?.streams.find((candidate) => idFor(found.path, candidate.index) === id);

      if (found === null || stream === undefined) {
        return null;
      }

      try {
        return await transcoder.readSubtitle({
          inputPath: found.path,
          streamIndex: stream.index,
        });
      } catch (error) {
        onProblem?.(found.path, error instanceof Error ? error.message : 'Unreadable.');

        return null;
      }
    },
  };
};

export type { EmbeddedStream };

export { createEmbeddedSubtitleService, describeSubtitle, marksHearingImpaired };
