import { cn } from '@FluxUI/cn';
import type { IconProps } from './Icon.types';

const RESTING = 'bold';

const IN_FORCE = 'fill';

/**
 * Every glyph in Valence, drawn from one set through one component.
 *
 * A caller names the icon it wants and this decides how it is drawn. That indirection is the point,
 * and it has already earned itself once: the set behind this changed and the six hundred places that
 * ask for an icon did not.
 *
 * A glyph at rest is drawn bold, and in force it is filled. Bold rather than the lighter weights
 * because these glyphs sit over artwork and beside heavy display type, where a hairline reads as
 * unfinished — and because the set this replaced was drawn with a rounded stroke of about this
 * weight, which is what the application has always looked like.
 *
 * Duotone was tried at rest and is not used there. It is a single fixed weight in this set — a
 * regular-weight outline with a tinted shape behind it — so it cannot be had thicker, and thin is
 * the thing being avoided. It remains one of the six a caller may name, and suits a large glyph on
 * an empty screen far better than an eighteen-pixel one in a row of controls.
 *
 * `whenActive` is how a glyph says a thing is in force — the filled twin of an outline. Where no
 * twin is given, the same shape is drawn filled instead, which is a real change of state rather than
 * the same glyph slightly heavier. That pairing is the reason for this set: at rest and in force are
 * two drawings of one icon, not one drawing at two stroke widths.
 *
 * @param of - Which icon, named from the icon package.
 * @param whenActive - A different icon to draw while what it stands for is in force.
 * @param isActive - Whether what it stands for is in force.
 * @param size - How large, in pixels.
 * @param weight - How it is drawn, where the caller wants something other than the two above.
 * @param className - Extra classes for the caller's own layout.
 * @param label - What it means in words, for a glyph that is not beside its own label.
 */
const Icon = ({
  of,
  whenActive,
  isActive = false,
  size = 18,
  weight,
  className,
  label,
}: IconProps) => {
  const Drawn = isActive && whenActive !== undefined ? whenActive : of;

  return (
    <Drawn
      size={size}
      weight={weight ?? (isActive ? IN_FORCE : RESTING)}
      className={cn('flux-icon', className)}
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    />
  );
};

Icon.displayName = 'Icon';

export { IN_FORCE, RESTING, Icon };
