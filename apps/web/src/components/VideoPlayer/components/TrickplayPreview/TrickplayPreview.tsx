import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchTrickplayModule from '@FluxWeb/playback/fetchTrickplay'
import type { TrickplayPreviewProps } from './TrickplayPreview.types'

const { formatDuration } = formatDurationModule
const { thumbnailAt } = fetchTrickplayModule

/**
 * The frame under the pointer while scrubbing.
 *
 * Drawn by offsetting a sheet inside a window the size of one tile, so hovering
 * across a timeline costs no requests beyond the sheets already fetched.
 */
const TrickplayPreview = ({ trickplay, seconds }: TrickplayPreviewProps) => {
  const thumbnail = thumbnailAt(trickplay.thumbnails, seconds)

  if (thumbnail === null) {
    return null
  }

  return (
    // The same glass as the bar it hangs over, so a frame of the film sits in
    // the interface rather than on top of it.
    <figure className="flux-glass overflow-hidden rounded-2xl p-1 text-white">
      <div
        role="img"
        aria-label={`Preview at ${formatDuration(seconds)}`}
        className="rounded-xl bg-black bg-no-repeat"
        style={{
          width: `${thumbnail.width.toString()}px`,
          height: `${thumbnail.height.toString()}px`,
          backgroundImage: `url(${thumbnail.sheetUrl})`,
          backgroundPosition: `-${thumbnail.x.toString()}px -${thumbnail.y.toString()}px`,
        }}
      />

      <figcaption className="px-2 pb-0.5 pt-1.5 text-center text-xs font-medium tabular-nums text-white/80">
        {formatDuration(seconds)}
      </figcaption>
    </figure>
  )
}

TrickplayPreview.displayName = 'TrickplayPreview'

export default { TrickplayPreview }
