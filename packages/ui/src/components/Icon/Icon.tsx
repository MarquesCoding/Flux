import { cn } from '@FluxUI/cn';
import type { IconProps } from './Icon.types';

const RESTING = 'duotone';

const IN_FORCE = 'fill';

/**
 * Every glyph in Flux, drawn from one set through one component.
 *
 * A caller names the icon it wants and this decides how it is drawn. That indirection is the point,
 * and it has already earned itself once: the set behind this changed and the six hundred places that
 * ask for an icon did not.
 *
 * A glyph at rest is drawn duotone: one shape stroked, the shape behind it laid in more faintly.
 * Because both halves are the current colour it takes whatever colour it is given without a second
 * variable being involved.
 *
 * How faint that second half is belongs to us rather than to the set. The set lays it in at a fifth
 * of the ink, which is drawn for dark glyphs on light paper; on a near-black surface a fifth of white
 * at eighteen pixels is not a tone, it is nothing, and the icon reads as the wireframe this set was
 * chosen to stop drawing. So the strength is a variable, set once in `flux.css`.
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
