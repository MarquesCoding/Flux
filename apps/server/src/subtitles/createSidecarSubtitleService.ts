import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import toWebVttModule from '@FluxCore/functions/toWebVtt'
import findSidecarSubtitlesModule from './findSidecarSubtitles'
import SubtitleServiceModule from './SubtitleService'
import type { SubtitleService, SubtitleTrack } from './SubtitleService'
import type { SidecarFile } from './findSidecarSubtitles'

const { toWebVtt } = toWebVttModule
const { findSidecarSubtitles, SUBTITLE_DIRECTORIES } = findSidecarSubtitlesModule
const { trackId } = SubtitleServiceModule

type MediaPathLookup = {
  findPath: (mediaId: string) => Promise<string | null>
}

type CreateSidecarSubtitleServiceOptions = {
  media: MediaPathLookup
  onProblem?: (path: string, reason: string) => void
}

/**
 * Lists a directory, treating an unreadable one as empty.
 *
 * A library on a network share disappears from time to time, and a viewer
 * pressing play should get their film without subtitles rather than an error.
 */
const listFiles = async (directory: string): Promise<SidecarFile[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ path: join(directory, entry.name), name: entry.name }))
  } catch {
    return []
  }
}

/**
 * Finds the subtitle directories sitting beside a video.
 */
const findSubtitleDirectories = async (directory: string): Promise<string[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isDirectory() && SUBTITLE_DIRECTORIES.has(entry.name.toLowerCase()))
      .map((entry) => join(directory, entry.name))
  } catch {
    return []
  }
}

/**
 * Subtitles read from the files beside a video.
 *
 * This is what Jellyfin calls external subtitles, and it is the whole of
 * Flux's built-in support: a track that already exists as text is served as
 * text. Nothing is demuxed out of the container and nothing is fetched from
 * the internet — a plugin that downloads subtitles writes them here, and they
 * appear like any other.
 */
const createSidecarSubtitleService = ({
  media,
  onProblem,
}: CreateSidecarSubtitleServiceOptions): SubtitleService => {
  const discover = async (mediaId: string) => {
    const videoPath = await media.findPath(mediaId)

    if (videoPath === null) {
      return null
    }

    const directory = dirname(videoPath)
    const videoName = basename(videoPath)

    const beside = findSidecarSubtitles(videoName, await listFiles(directory))

    const nested = await Promise.all(
      (await findSubtitleDirectories(directory)).map(async (subtitleDirectory) =>
        findSidecarSubtitles(videoName, await listFiles(subtitleDirectory), {
          fromSubtitleDirectory: true,
        }),
      ),
    )

    return [...beside, ...nested.flat()]
  }

  return {
    list: async (mediaId) => {
      const found = await discover(mediaId)

      if (found === null) {
        return null
      }

      const tracks: SubtitleTrack[] = found.map((track) => ({
        id: trackId(track.path),
        language: track.language,
        label: track.label,
        format: track.format,
        isForced: track.isForced,
        isHearingImpaired: track.isHearingImpaired,
      }))

      return tracks
    },

    read: async (mediaId, id) => {
      const found = await discover(mediaId)
      const track = found?.find((candidate) => trackId(candidate.path) === id)

      if (track === undefined) {
        return null
      }

      try {
        // Read as UTF-8 and let a mis-encoded file arrive as replacement
        // characters rather than failing: a track with mangled accents is
        // still better than no subtitles at all.
        return toWebVtt(await readFile(track.path, 'utf8'), track.format)
      } catch (error) {
        onProblem?.(track.path, error instanceof Error ? error.message : 'Unreadable.')

        return null
      }
    },
  }
}

export type { CreateSidecarSubtitleServiceOptions, MediaPathLookup }

export default { createSidecarSubtitleService, listFiles, findSubtitleDirectories }
