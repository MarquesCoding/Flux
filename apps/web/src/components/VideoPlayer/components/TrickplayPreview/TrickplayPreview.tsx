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
    // Built like the bar it hangs over, down to the padding, the corner and
    // the way the time is set: the frame under the pointer belongs to the
    // controls somebody is already using rather than to a tooltip that
    // happens to be nearby.
    <figure className="flux-glass flex flex-col gap-1 rounded-2xl px-3 py-2 text-white">
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

      <figcaption className="text-center text-xs tabular-nums sm:text-sm">
        {formatDuration(seconds)}
      </figcaption>
    </figure>
  )
}

TrickplayPreview.displayName = 'TrickplayPreview'

export default { TrickplayPreview }
