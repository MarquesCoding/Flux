import { formatDuration } from '@FluxCore/functions/formatDuration';
import { thumbnailAt } from '@FluxScreens/playback/fetchTrickplay';
import type { TrickplayPreviewProps } from './TrickplayPreview.types';

/**
 * Shows where the pointer is while somebody scrubs, with the frame there if there is one. The frame
 * comes from the sprite sheet built when the item was scanned — one image holding every thumbnail,
 * so the right frame is found by offsetting the background rather than by fetching anything.
 *
 * The time is always shown and the frame is not. Sheets are built in the background, a position
 * part-way through a sheet still being written has no thumbnail, and both used to remove the whole
 * panel — so the one piece of information that never needs a sheet went missing along with the one
 * that does, and hovering the bar appeared to do nothing at all. An empty frame of the right size
 * also keeps the panel from changing shape as sheets arrive.
 *
 * @param trickplay - The sheet and how its frames are arranged, or nothing where none is built yet.
 * @param seconds - Where the pointer is.
 */
const TrickplayPreview = ({ trickplay, seconds }: TrickplayPreviewProps) => {
  const thumbnail = trickplay === null ? null : thumbnailAt(trickplay.thumbnails, seconds);

  return (
    <figure className="flux-glass mb-2 flex flex-col gap-1 rounded-lg px-2 py-2 text-white">
      {thumbnail === null ? null : (
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
      )}

      <figcaption className="text-center text-md mt-2">{formatDuration(seconds)}</figcaption>
    </figure>
  );
};

TrickplayPreview.displayName = 'TrickplayPreview';

export { TrickplayPreview };
