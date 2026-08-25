import { cn } from '@ValenceUI/cn';
import type { BackdropScrimProps } from './BackdropScrim.types';

/**
 * The darkening laid over the foot of a backdrop so that a title and its controls stay readable
 * against whatever the artwork happens to be.
 *
 * The darkening is the same in both themes because it is laid over artwork rather than over the
 * page — a gradient that carried the page's colours washed the picture out in white under the light
 * theme and then wrote white text on it.
 *
 * It does not fade the foot of the picture into the panel. It used to, in a colour the panel was
 * painted in, from back when a dialog was opaque. A dialog is glass now, so there is no one colour
 * to arrive at: the fade painted a flat opaque band over a panel that is showing the blurred
 * backdrop through itself, and read as a smear rather than a join. The artwork ends at the corner
 * it is clipped to, the way its other three edges already did.
 *
 * It covers the whole picture rather than the part of it that needs darkening, and keeps the ramp
 * in the bottom of the gradient instead. Sized to the foot it drew a hairline along both its own
 * edges: it fades, so it is rasterised on its own layer, and it landed on fractions of a device
 * pixel at top and bottom with the picture carrying on either side of them. Given the same box as
 * the picture its edges fall where the picture's already do, and the clip they share is the only
 * boundary left. It is what the hero has always done, and the hero has never shown the line.
 *
 * The darkening down the left is anchored to the bottom corner rather than run straight across.
 * A `to right` gradient is constant top to bottom, so on a scrim that covers only part of the
 * artwork it arrived at full strength along its own top edge and drew a hard line across the
 * picture, in both themes. Anchored at the corner it falls away upwards as well and meets nothing.
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
      'pointer-events-none absolute inset-0',
      'valence-artwork-scrim valence-artwork-scrim--foot',
      className,
    )}
  />
);

BackdropScrim.displayName = 'BackdropScrim';

export { BackdropScrim };
