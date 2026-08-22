import { describeLanguage, readLanguage } from '@ValenceCore/functions/describeTrack';

const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'ass', 'ssa']);

const SUBTITLE_DIRECTORIES = new Set(['subs', 'subtitles']);

const FORCED_MARKERS = new Set(['forced']);

const HEARING_IMPAIRED_MARKERS = new Set(['sdh', 'cc', 'hi']);

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
  let language: string | null = null;
  let isForced = false;
  let isHearingImpaired = false;

  for (const tag of tags) {
    const lowered = tag.toLowerCase();

    if (FORCED_MARKERS.has(lowered)) {
      isForced = true;

      continue;
    }

    if (HEARING_IMPAIRED_MARKERS.has(lowered)) {
      isHearingImpaired = true;

      continue;
    }

    if (language === null && lowered !== '') {
      language = readLanguage(lowered);
    }
  }

  return { language, isForced, isHearingImpaired };
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
 * Picks the subtitle files belonging to one video from the files beside it, matching on the video's
 * own name so that a folder holding a season does not offer every episode's subtitles for each.
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

  for (const file of files) {
    const { stem: fileStem, extension } = splitName(file.name);

    if (!SUBTITLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const belongsByName = fileStem === stem || fileStem.startsWith(`${stem}.`);

    if (!belongsByName && options.fromSubtitleDirectory !== true) {
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

export { findSidecarSubtitles, describeTags, describeLabel, splitName, SUBTITLE_DIRECTORIES };
