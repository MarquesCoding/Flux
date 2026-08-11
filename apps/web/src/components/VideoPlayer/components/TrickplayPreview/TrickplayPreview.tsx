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
    // happens to be nearby. The bar's own glass, so it adapts to the theme
    // with it rather than staying dark while the bar lightens.
    <figure className="flux-glass mb-2 flex flex-col gap-1 rounded-3xl px-2 py-2 text-white">
      <div
        role="img"
        aria-label={`Preview at ${formatDuration(seconds)}`}
        // The page's own surface under the frame rather than black. A sheet
        // that has not arrived, or a frame narrower than its tile, shows what
        // is beneath it — and a black plate inside pale glass is the one part
        // of this that did not follow the theme.
        className="rounded-xl bg-surface bg-no-repeat"
        style={{
          width: `${thumbnail.width.toString()}px`,
          height: `${thumbnail.height.toString()}px`,
          backgroundImage: `url(${thumbnail.sheetUrl})`,
          backgroundPosition: `-${thumbnail.x.toString()}px -${thumbnail.y.toString()}px`,
        }}
      />

      <figcaption className="text-center text-md mt-2">{formatDuration(seconds)}</figcaption>
    </figure>
  )
}

TrickplayPreview.displayName = 'TrickplayPreview'

export default { TrickplayPreview }
