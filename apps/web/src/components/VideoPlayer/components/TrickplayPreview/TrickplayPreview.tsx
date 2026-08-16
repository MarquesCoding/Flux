import { formatDuration } from '@FluxCore/functions/formatDuration';
import { thumbnailAt } from '@FluxWeb/playback/fetchTrickplay';
import type { TrickplayPreviewProps } from './TrickplayPreview.types';

/**
 * Shows the frame under the pointer while somebody scrubs, taken from the sprite sheet built when
 * the item was scanned. The sheet is one image holding every thumbnail, so the right frame is found
 * by offsetting the background rather than by fetching anything.
 *
 * @param trickplay - The sheet, and how the frames are arranged within it.
 * @param seconds - Where the pointer is.
 */
const TrickplayPreview = ({ trickplay, seconds }: TrickplayPreviewProps) => {
  const thumbnail = thumbnailAt(trickplay.thumbnails, seconds);

  if (thumbnail === null) {
    return null;
  }

  return (
    <figure className="flux-glass mb-2 flex flex-col gap-1 rounded-xl px-2 py-2 text-white">
      <div
        role="img"
        aria-label={`Preview at ${formatDuration(seconds)}`}
        className="rounded-lg bg-surface bg-no-repeat"
        style={{
          width: `${thumbnail.width.toString()}px`,
          height: `${thumbnail.height.toString()}px`,
          backgroundImage: `url(${thumbnail.sheetUrl})`,
          backgroundPosition: `-${thumbnail.x.toString()}px -${thumbnail.y.toString()}px`,
        }}
      />

      <figcaption className="text-center text-md mt-2">{formatDuration(seconds)}</figcaption>
    </figure>
  );
};

TrickplayPreview.displayName = 'TrickplayPreview';

export { TrickplayPreview };
