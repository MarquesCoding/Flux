import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { toWebVtt } from '@ValenceCore/functions/toWebVtt';
import {
  findSidecarSubtitles,
  isBitmapSubtitle,
  splitName,
  SUBTITLE_DIRECTORIES,
} from './findSidecarSubtitles';
import { trackId } from './SubtitleService';
import type { SubtitleService, SubtitleTrack } from './SubtitleService';
import type { SidecarFile } from './findSidecarSubtitles';

type MediaPathLookup = {
  findPath: (mediaId: string) => Promise<string | null>;
};

type CreateSidecarSubtitleServiceOptions = {
  media: MediaPathLookup;
  onProblem?: (path: string, reason: string) => void;
};

/**
 * Lists a directory, treating one that cannot be read as empty. A subtitle folder that is missing or
 * unreadable should cost a viewer the subtitles in it, not the film.
 *
 * @param directory - The directory to list.
 * @returns Its filenames, or none where it could not be read.
 */
const listFiles = async (directory: string): Promise<SidecarFile[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ path: join(directory, entry.name), name: entry.name }));
  } catch {
    return [];
  }
};

/**
 * Finds the directories people keep subtitles in beside a video — `Subs`, `Subtitles`, and the same
 * named after the file itself — since plenty of collections separate them rather than leaving them
 * alongside.
 *
 * @param directory - The video being played.
 * @returns The directories worth looking in.
 */
const findSubtitleDirectories = async (directory: string): Promise<string[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory() && SUBTITLE_DIRECTORIES.has(entry.name.toLowerCase()))
      .map((entry) => join(directory, entry.name));
  } catch {
    return [];
  }
};

/**
 * Finds the folder inside a subtitle directory that is named after the video being played, which is
 * how a collection keeps one episode's subtitles apart from the rest of its season's.
 *
 * @param directory - The subtitle directory to look inside.
 * @param stem - The video's name, without its extension.
 * @returns The folder belonging to this video, or nothing where there is none.
 */
const findNamedChild = async (directory: string, stem: string): Promise<string | null> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const found = entries.find((entry) => entry.isDirectory() && entry.name === stem);

    return found === undefined ? null : join(directory, found.name);
  } catch {
    return null;
  }
};

/**
 * Subtitles read from the files sitting beside a video, converted to the one format a browser will
 * take. These are the tracks somebody downloaded themselves, and are usually better than what the
 * container holds.
 *
 * @param options - How to read the directory and the files in it.
 * @returns The subtitle service.
 */
const createSidecarSubtitleService = ({
  media,
  onProblem,
}: CreateSidecarSubtitleServiceOptions): SubtitleService => {
  const discover = async (mediaId: string) => {
    const videoPath = await media.findPath(mediaId);

    if (videoPath === null) {
      return null;
    }

    const directory = dirname(videoPath);
    const videoName = basename(videoPath);
    const { stem } = splitName(videoName);

    const inFolder = await listFiles(directory);
    const beside = findSidecarSubtitles(videoName, inFolder);

    const subtitleDirectories = await findSubtitleDirectories(directory);
    const named = await Promise.all(
      subtitleDirectories.map((subtitleDirectory) => findNamedChild(subtitleDirectory, stem)),
    );

    const nested = await Promise.all(
      [...subtitleDirectories, ...named.filter((one): one is string => one !== null)].map(
        async (subtitleDirectory) =>
          findSidecarSubtitles(videoName, await listFiles(subtitleDirectory), {
            fromSubtitleDirectory: true,
          }),
      ),
    );

    return {
      tracks: [...beside, ...nested.flat()],
      pictures: inFolder.filter(
        (file) => isBitmapSubtitle(file.name) && splitName(file.name).stem.startsWith(stem),
      ),
    };
  };

  return {
    list: async (mediaId) => {
      const found = await discover(mediaId);

      if (found === null) {
        return null;
      }

      for (const picture of found.pictures) {
        onProblem?.(
          picture.path,
          'A subtitle held as pictures rather than text, which cannot be shown yet.',
        );
      }

      const tracks: SubtitleTrack[] = found.tracks.map((track) => ({
        id: trackId(track.path),
        language: track.language,
        label: track.label,
        format: track.format,
        isForced: track.isForced,
        isHearingImpaired: track.isHearingImpaired,
        delivery: 'text' as const,
        streamIndex: null,
      }));

      return tracks;
    },

    read: async (mediaId, id) => {
      const found = await discover(mediaId);
      const track = found?.tracks.find((candidate) => trackId(candidate.path) === id);

      if (track === undefined) {
        return null;
      }

      try {
        return toWebVtt(await readFile(track.path, 'utf8'), track.format);
      } catch (error) {
        onProblem?.(track.path, error instanceof Error ? error.message : 'Unreadable.');

        return null;
      }
    },
  };
};

export { createSidecarSubtitleService, listFiles };
