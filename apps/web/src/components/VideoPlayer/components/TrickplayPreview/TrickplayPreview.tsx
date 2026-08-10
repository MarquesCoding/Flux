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
    <figure className="overflow-hidden rounded-md border border-border bg-surface-raised shadow-lg">
      <div
        role="img"
        aria-label={`Preview at ${formatDuration(seconds)}`}
        className="bg-black bg-no-repeat"
        style={{
          width: `${thumbnail.width.toString()}px`,
          height: `${thumbnail.height.toString()}px`,
          backgroundImage: `url(${thumbnail.sheetUrl})`,
          backgroundPosition: `-${thumbnail.x.toString()}px -${thumbnail.y.toString()}px`,
        }}
      />

      <figcaption className="px-2 py-1 text-center text-xs tabular-nums text-text-muted">
        {formatDuration(seconds)}
      </figcaption>
    </figure>
  )
}

TrickplayPreview.displayName = 'TrickplayPreview'

export default { TrickplayPreview }
