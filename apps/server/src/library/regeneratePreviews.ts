import selectAudioStreamModule from '@FluxCore/functions/describeTrack'
import type { AudioStream } from '@FluxContracts/schemas/MediaItem'
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient'

const { selectAudioStream } = selectAudioStreamModule

/**
 * The library table, as regeneration sees it.
 */
type PreviewStore = {
  listForRegeneration: (
    libraryId: string,
  ) => Promise<{ path: string; audioStreams: AudioStream[] }[]>
}

type RegeneratePreviewsOptions = {
  libraryId: string
  store: PreviewStore
  transcoder: Transcoder
  /**
   * The language previews should prefer, when the library forces one.
   */
  defaultAudioLanguage: string | null
  onProblem?: (path: string, reason: string) => void
  onProgress?: (processed: number, total: number) => void
}

/**
 * Re-renders every preview clip in a library against its current forced
 * audio language, without touching anything else a scan would.
 *
 * Deliberately narrow: an admin changing "Force Default Audio Track" wants
 * previews caught up, not every file re-probed, re-matched against a
 * catalogue and re-sampled for colour. That work already ran; this reuses
 * it, at a fraction of the resource cost of a forced rescan.
 */
const regeneratePreviews = async ({
  libraryId,
  store,
  transcoder,
  defaultAudioLanguage,
  onProblem,
  onProgress,
}: RegeneratePreviewsOptions): Promise<void> => {
  const items = await store.listForRegeneration(libraryId)
  let processed = 0

  onProgress?.(processed, items.length)

  for (const item of items) {
    const audioStreamIndex =
      defaultAudioLanguage === null
        ? undefined
        : selectAudioStream(item.audioStreams, defaultAudioLanguage)?.index

    await transcoder
      .requestPreview({
        inputPath: item.path,
        wait: true,
        ...(audioStreamIndex === undefined ? {} : { audioStreamIndex }),
      })
      .catch((error: Error) => {
        onProblem?.(item.path, error.message)
      })

    processed += 1
    onProgress?.(processed, items.length)
  }
}

export type { PreviewStore }

export default { regeneratePreviews }
