import { cn } from '@ValenceUI/cn';
import type { BackdropScrimProps } from './BackdropScrim.types';

/**
 * The darkening laid over the foot of a backdrop so that a title and its controls stay readable
 * against whatever the artwork happens to be, and so the picture meets the panel below it rather
 * than stopping at it.
 *
 * It fades to `surface-raised` because that is what a dialog is painted in. Fading to `surface`
 * instead — a fifth of a step darker in the dark theme — left a visible ledge along the join, the
 * gradient having arrived at a colour nothing beneath it was.
 *
 * It also reaches a pixel past its container. A backdrop is given a height in viewport units, which
 * lands on a fraction of a device pixel; the gradient stopped on the near side of that fraction and
 * a sliver of undarkened artwork showed through as a bright line the width of the dialog. The extra
 * pixel is covered by the gradient's own opaque end, so overlapping the panel costs nothing.
 *
 * The ramp is weighted to the bottom. Left at its midpoint the gradient was still four fifths
 * opaque halfway up, which is well above anything it needs to hide and is where a preview's
 * subtitles sit — those are painted by the browser inside the video, so nothing can be stacked
 * beneath them and a heavy scrim simply greys them out. Reaching that opacity lower down darkens
 * what the title stands on and leaves the picture above it alone.
 *
 * @param className - Extra classes for the caller's own layout.
 */
const BackdropScrim = ({ className }: BackdropScrimProps) => (
  <div
    aria-hidden
    className={cn(
      'pointer-events-none absolute inset-x-0 -bottom-px h-2/3',
      'bg-gradient-to-t from-surface-raised via-surface-raised/60 via-35% to-transparent',
      className,
    )}
  />
);

BackdropScrim.displayName = 'BackdropScrim';

export { BackdropScrim };
