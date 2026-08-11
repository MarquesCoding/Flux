import describeTrackModule from '@FluxCore/functions/describeTrack'
import SubtitleServiceModule from './SubtitleService'
import type { SubtitleService, SubtitleTrack } from './SubtitleService'

const { describeLanguage, readLanguage } = describeTrackModule
const { trackId } = SubtitleServiceModule

/**
 * Marks a title puts on a track that carries more than dialogue.
 */
const HEARING_IMPAIRED_MARKERS = ['sdh', 'cc', 'hearing', 'hard of hearing']

/**
 * Formats that carry pictures of words rather than words.
 */
const IMAGE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub'])

/**
 * One subtitle stream, as the container describes it.
 */
type EmbeddedStream = {
  index: number
  format: string
  language?: string | null | undefined
  title?: string | null | undefined
  isForced: boolean
}

/**
 * A file and what is inside it.
 */
type EmbeddedLookup = {
  find: (mediaId: string) => Promise<{ path: string; streams: EmbeddedStream[] } | null>
}

type Extractor = {
  readSubtitle: (request: { inputPath: string; streamIndex: number }) => Promise<string>
}

type CreateEmbeddedSubtitleServiceOptions = {
  media: EmbeddedLookup
  transcoder: Extractor
  onProblem?: (path: string, reason: string) => void
}

/**
 * Names a track for a menu.
 *
 * Built from whatever the container actually said, in descending order of how
 * much it tells a viewer. A file that names its tracks — "English-SRT",
 * "French-SDH" — has already done this job better than any convention could,
 * so its own name wins.
 */
const describeSubtitle = (stream: EmbeddedStream, position: number): string => {
  const language = describeLanguage(stream.language)
  const title = stream.title?.trim() ?? ''
  const saysLanguage = language !== null && title.toLowerCase().includes(language.toLowerCase())

  const named =
    title === ''
      ? (language ?? `Track ${position.toString()}`)
      : language === null || saysLanguage
        ? title
        : `${language} · ${title}`

  return stream.isForced && !named.toLowerCase().includes('forced') ? `${named} · Forced` : named
}

/**
 * Whether a track's own name says it transcribes more than the dialogue.
 */
const marksHearingImpaired = (title: string | null | undefined): boolean => {
  const lowered = (title ?? '').toLowerCase()

  return HEARING_IMPAIRED_MARKERS.some((marker) => lowered.includes(marker))
}

/**
 * Subtitles read out of the container itself.
 *
 * This is why a file VLC offers three subtitle tracks for is not a file Flux
 * says has none: most releases carry their subtitles inside the video rather
 * than beside it. Text tracks are pulled out on demand and converted to
 * WebVTT, which costs about a second because nothing but the subtitle packets
 * is read.
 *
 * Picture based tracks — PGS, VobSub — are left out on purpose. They carry
 * images of words rather than words, so they cannot become text at all; when
 * one of those is wanted it is burned into the video, which playback
 * negotiation decides.
 */
const createEmbeddedSubtitleService = ({
  media,
  transcoder,
  onProblem,
}: CreateEmbeddedSubtitleServiceOptions): SubtitleService => {
  const discover = async (mediaId: string) => {
    const found = await media.find(mediaId)

    if (found === null) {
      return null
    }

    const streams = found.streams.filter((stream) => !IMAGE_FORMATS.has(stream.format))

    return { path: found.path, streams }
  }

  /**
   * Names a stream, so listing and reading agree on what a track is called.
   */
  const idFor = (path: string, index: number): string => trackId(`${path}#${index.toString()}`)

  return {
    list: async (mediaId) => {
      const found = await discover(mediaId)

      if (found === null) {
        return null
      }

      const tracks: SubtitleTrack[] = found.streams.map((stream, position) => ({
        id: idFor(found.path, stream.index),
        language: readLanguage(stream.language),
        label: describeSubtitle(stream, position + 1),
        format: stream.format,
        isForced: stream.isForced,
        isHearingImpaired: marksHearingImpaired(stream.title),
      }))

      return tracks
    },

    read: async (mediaId, id) => {
      const found = await discover(mediaId)
      const stream = found?.streams.find((candidate) => idFor(found.path, candidate.index) === id)

      if (found === null || stream === undefined) {
        return null
      }

      try {
        return await transcoder.readSubtitle({
          inputPath: found.path,
          streamIndex: stream.index,
        })
      } catch (error) {
        onProblem?.(found.path, error instanceof Error ? error.message : 'Unreadable.')

        return null
      }
    },
  }
}

export type { CreateEmbeddedSubtitleServiceOptions, EmbeddedLookup, EmbeddedStream }

export default { createEmbeddedSubtitleService, describeSubtitle, marksHearingImpaired }
