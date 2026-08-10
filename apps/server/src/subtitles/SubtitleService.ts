import { createHash } from 'node:crypto'

type SubtitleTrack = {
  /**
   * Content addressed from the file's path, so the identifier survives a
   * restart and cannot be used to name a file the caller chose.
   */
  id: string
  language: string | null
  label: string
  format: string
  isForced: boolean
  isHearingImpaired: boolean
}

/**
 * The subtitle files beside one video.
 *
 * A port rather than the filesystem directly, so the routes can be tested
 * without a disk and so a plugin that downloads tracks can satisfy the same
 * shape. Downloaded tracks land beside the video, so a provider is a thing
 * that writes files rather than a thing Flux reads through.
 */
type SubtitleService = {
  list: (mediaId: string) => Promise<SubtitleTrack[] | null>
  /**
   * Reads a track as WebVTT, converting it if it arrived as something else.
   */
  read: (mediaId: string, trackId: string) => Promise<string | null>
}

/**
 * Names a track from its path.
 */
const trackId = (path: string): string =>
  createHash('sha256').update(path).digest('hex').slice(0, 16)

export type { SubtitleService, SubtitleTrack }

export default { trackId }
