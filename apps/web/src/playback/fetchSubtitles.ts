import { z } from 'zod'

const SubtitleTrackSchema = z.object({
  id: z.string(),
  language: z.string().nullable(),
  label: z.string(),
  format: z.string(),
  isForced: z.boolean(),
  isHearingImpaired: z.boolean(),
})

const SubtitleListSchema = z.object({ tracks: z.array(SubtitleTrackSchema) })

type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>

/**
 * The value standing for showing no captions at all.
 *
 * A menu of tracks needs an entry for turning them off, and an empty string
 * would be indistinguishable from a track whose id failed to arrive.
 */
const SUBTITLES_OFF = 'off'

/**
 * Reads the subtitle tracks sitting beside an item.
 *
 * Answers with nothing rather than throwing: captions are an addition to
 * playback and their absence must never stop a film from playing.
 */
const fetchSubtitleTracks = async (mediaId: string): Promise<SubtitleTrack[]> => {
  try {
    const response = await fetch(`/api/media/${mediaId}/subtitles`, {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return SubtitleListSchema.parse(await response.json()).tracks
  } catch {
    return []
  }
}

/**
 * Where a track is served from.
 */
const subtitleTrackUrl = (mediaId: string, trackId: string): string =>
  `/api/media/${mediaId}/subtitles/${trackId}`

/**
 * Picks the track to show before anyone has chosen one.
 *
 * A forced track is what a viewer who does not want subtitles still wants:
 * it carries only the parts spoken in another language. Anything else stays
 * off until asked for.
 */
const defaultTrackId = (tracks: SubtitleTrack[]): string =>
  tracks.find((track) => track.isForced)?.id ?? SUBTITLES_OFF

export type { SubtitleTrack }

export default { fetchSubtitleTracks, subtitleTrackUrl, defaultTrackId, SUBTITLES_OFF }
