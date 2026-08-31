import { describeLanguage, readLanguage } from '@ValenceCore/functions/describeTrack';
import { isMediaFile } from '@ValenceServer/library/readTitleFromPath';
import { readEpisodeFromPath } from '@ValenceServer/library/readEpisodeFromPath';

const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'ass', 'ssa']);

const BITMAP_SUBTITLE_EXTENSIONS = new Set(['sup', 'sub', 'idx']);

const SUBTITLE_DIRECTORIES = new Set(['subs', 'subtitles']);

const FORCED_MARKERS = new Set(['forced']);

const HEARING_IMPAIRED_MARKERS = new Set(['sdh', 'cc']);

const HINDI = 'hi';

const AMBIGUOUS_MARKERS = new Set([HINDI]);

const IGNORED_MARKERS = new Set(['default']);

type SidecarFile = {
  path: string;
  name: string;
};

type SidecarSubtitle = {
  path: string;
  format: string;
  language: string | null;
  label: string;
  isForced: boolean;
  isHearingImpaired: boolean;
};

/**
 * Splits a filename into the part before the final dot and the part after it, which is how a
 * subtitle file beside a video is matched to it.
 *
 * @param name - The filename.
 * @returns The stem and the extension, the extension lowered.
 */
const splitName = (name: string): { stem: string; extension: string } => {
  const dot = name.lastIndexOf('.');

  return dot <= 0
    ? { stem: name, extension: '' }
    : { stem: name.slice(0, dot), extension: name.slice(dot + 1).toLowerCase() };
};

/**
 * Reads what a subtitle filename claims about its track — the language, whether it is forced,
 * whether it transcribes more than the dialogue — from the tags people put between dots. There is no
 * standard for this, so several spellings of each are accepted.
 *
 * @param tags - The parts of the filename between dots, once the video's own name is stripped.
 * @returns The language and flags the name claimed.
 */
const describeTags = (
  tags: string[],
): { language: string | null; isForced: boolean; isHearingImpaired: boolean } => {
  const lowered = tags.map((tag) => tag.toLowerCase()).filter((tag) => tag !== '');

  const named = lowered.filter(
    (tag) =>
      !FORCED_MARKERS.has(tag) &&
      !HEARING_IMPAIRED_MARKERS.has(tag) &&
      !AMBIGUOUS_MARKERS.has(tag) &&
      !IGNORED_MARKERS.has(tag),
  );

  const spoken = named.map((tag) => readLanguage(tag)).find((one) => one !== null) ?? null;
  const saysAmbiguous = lowered.some((tag) => AMBIGUOUS_MARKERS.has(tag));

  return {
    language: spoken ?? (saysAmbiguous ? readLanguage(HINDI) : null),
    isForced: lowered.some((tag) => FORCED_MARKERS.has(tag)),
    isHearingImpaired:
      lowered.some((tag) => HEARING_IMPAIRED_MARKERS.has(tag)) ||
      (spoken !== null && saysAmbiguous),
  };
};

/**
 * Names a subtitle track the way it should read in a menu: the language in its own words, then what
 * makes it different from the other track in the same language — forced, or transcribing the sound
 * as well as the dialogue.
 *
 * @param language - The language the filename claimed.
 * @param isForced - Whether it claimed the track is forced.
 * @param isHearingImpaired - Whether it claimed the track transcribes the sound as well.
 * @returns The line to show in a menu.
 */
const describeLabel = (
  language: string | null,
  isForced: boolean,
  isHearingImpaired: boolean,
): string => {
  const base = describeLanguage(language) ?? 'Unknown';
  const notes = [isForced ? 'forced' : '', isHearingImpaired ? 'SDH' : ''].filter(
    (note) => note !== '',
  );

  return notes.length === 0 ? base : `${base} (${notes.join(', ')})`;
};

/**
 * Says whether a subtitle file is one Valence cannot draw — a disc's, which is pictures of text
 * rather than text, and needs burning in or a renderer of its own.
 *
 * @param name - The file's name.
 * @returns Whether it is a subtitle held as pictures.
 */
const isBitmapSubtitle = (name: string): boolean =>
  BITMAP_SUBTITLE_EXTENSIONS.has(splitName(name).extension);

/**
 * Decides whether a folder holds one film and nothing to confuse it with, which is what makes it
 * safe to take a subtitle that does not repeat the film's name.
 *
 * A season folder is refused however few episodes are left in it. Downloaders leave subtitles behind
 * for episodes that have gone, and attaching those to the one episode still there would be
 * confidently wrong — worse than offering nothing.
 *
 * @param videoName - The video being played.
 * @param files - Everything in the folder holding it.
 * @returns Whether the folder is one film's own.
 */
const standsAlone = (videoName: string, files: SidecarFile[]): boolean =>
  readEpisodeFromPath(videoName).episodeNumber === null &&
  files.filter((file) => isMediaFile(file.name)).length === 1;

/**
 * Picks the subtitle files belonging to one video from the files beside it, matching on the video's
 * own name so that a folder holding a season does not offer every episode's subtitles for each.
 *
 * Where the folder holds one film and nothing else, that matching is dropped: a subtitle named for
 * its language rather than for the film — what Bazarr and MakeMKV write — belongs to the only thing
 * it could belong to.
 *
 * @param videoName - The video being played.
 * @param files - The files found beside it and in any subtitle directories.
 * @param options - Whether these came from a subtitle directory, where a file need not repeat the
 *   video's name to belong to it.
 * @returns One track per file that belongs, named for a menu.
 */
const findSidecarSubtitles = (
  videoName: string,
  files: SidecarFile[],
  options: { fromSubtitleDirectory?: boolean } = {},
): SidecarSubtitle[] => {
  const { stem } = splitName(videoName);
  const found: SidecarSubtitle[] = [];
  const takesAnything = options.fromSubtitleDirectory === true || standsAlone(videoName, files);

  for (const file of files) {
    const { stem: fileStem, extension } = splitName(file.name);

    if (!SUBTITLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const belongsByName = fileStem === stem || fileStem.startsWith(`${stem}.`);

    if (!belongsByName && !takesAnything) {
      continue;
    }

    const tags = belongsByName
      ? fileStem.slice(stem.length).split('.').filter(Boolean)
      : fileStem.split('.').filter(Boolean);

    const { language, isForced, isHearingImpaired } = describeTags(tags);

    found.push({
      path: file.path,
      format: extension,
      language,
      label: describeLabel(language, isForced, isHearingImpaired),
      isForced,
      isHearingImpaired,
    });
  }

  return found;
};

export type { SidecarFile };

export {
  findSidecarSubtitles,
  describeTags,
  describeLabel,
  isBitmapSubtitle,
  splitName,
  SUBTITLE_DIRECTORIES,
};
