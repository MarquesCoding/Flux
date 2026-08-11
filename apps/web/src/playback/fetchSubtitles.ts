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
const subtitleTrackUrl = (mediaId: string, trackId: string, fromSeconds = 0): string =>
  `/api/media/${mediaId}/subtitles/${trackId}?from=${Math.max(0, Math.floor(fromSeconds)).toString()}`

/**
 * Picks the track to show before anyone has chosen one.
 *
 * A forced track is what a viewer who does not want subtitles still wants:
 * it carries only the parts spoken in another language. Anything else stays
 * off until asked for.
 */
const defaultTrackId = (tracks: SubtitleTrack[]): string =>
  tracks.find((track) => track.isForced)?.id ?? SUBTITLES_OFF

/**
 * The track that continues what a viewer was already reading.
 *
 * A track is named from the file it lives in, so the identifier that means
 * "English" for one episode means nothing for the next. What somebody chose
 * was a language, and matching on that is what carries a choice from one
 * episode into the following one.
 *
 * Answers with nothing when the language was never chosen, or when this file
 * has nothing in it — a viewer who asked for English and got a Hungarian
 * track because it was the only one would rightly call that broken.
 */
const trackForLanguage = (
  tracks: SubtitleTrack[],
  language: string | null,
): SubtitleTrack | null => {
  if (language === null || language === '') {
    return null
  }

  const spoken = language.split('-')[0]?.toLowerCase() ?? ''

  return tracks.find((track) => (track.language ?? '').toLowerCase().startsWith(spoken)) ?? null
}

/**
 * The track a preview should carry.
 *
 * Different question from the player's default, which stays off until asked:
 * a preview is decoration, and decoration in a language somebody cannot read
 * is decoration wasted. The browser's own language wins where the file has
 * it, and the first track stands in where it does not.
 */
const previewTrack = (tracks: SubtitleTrack[], language: string): SubtitleTrack | null => {
  const spoken = language.split('-')[0]?.toLowerCase() ?? ''

  return (
    tracks.find((track) => (track.language ?? '').toLowerCase().startsWith(spoken)) ??
    tracks[0] ??
    null
  )
}

export type { SubtitleTrack }

export {
  fetchSubtitleTracks,
  subtitleTrackUrl,
  defaultTrackId,
  previewTrack,
  trackForLanguage,
  SUBTITLES_OFF,
}
