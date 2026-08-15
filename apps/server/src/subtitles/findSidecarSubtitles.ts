import { describeLanguage, readLanguage } from '@FluxCore/functions/describeTrack';

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
 * Splits a filename into its stem and extension.
 */
const splitName = (name: string): { stem: string; extension: string } => {
  const dot = name.lastIndexOf('.');

  return dot <= 0
    ? { stem: name, extension: '' }
    : { stem: name.slice(0, dot), extension: name.slice(dot + 1).toLowerCase() };
};

/**
 * Reads what a subtitle filename says about the track.
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
 * Names a track the way it should appear in a menu.
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
 * Picks the subtitle files that belong to one video.
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
