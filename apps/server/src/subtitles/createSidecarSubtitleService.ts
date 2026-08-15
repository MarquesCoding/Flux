import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { toWebVtt } from '@FluxCore/functions/toWebVtt';
import { findSidecarSubtitles, SUBTITLE_DIRECTORIES } from './findSidecarSubtitles';
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
 * Lists a directory, treating an unreadable one as empty.
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
 * Finds the subtitle directories sitting beside a video.
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
 * Subtitles read from the files beside a video.
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

    const beside = findSidecarSubtitles(videoName, await listFiles(directory));

    const nested = await Promise.all(
      (await findSubtitleDirectories(directory)).map(async (subtitleDirectory) =>
        findSidecarSubtitles(videoName, await listFiles(subtitleDirectory), {
          fromSubtitleDirectory: true,
        }),
      ),
    );

    return [...beside, ...nested.flat()];
  };

  return {
    list: async (mediaId) => {
      const found = await discover(mediaId);

      if (found === null) {
        return null;
      }

      const tracks: SubtitleTrack[] = found.map((track) => ({
        id: trackId(track.path),
        language: track.language,
        label: track.label,
        format: track.format,
        isForced: track.isForced,
        isHearingImpaired: track.isHearingImpaired,
      }));

      return tracks;
    },

    read: async (mediaId, id) => {
      const found = await discover(mediaId);
      const track = found?.find((candidate) => trackId(candidate.path) === id);

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
