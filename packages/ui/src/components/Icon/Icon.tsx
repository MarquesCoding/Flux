import { HugeiconsIcon } from '@hugeicons/react';
import type { IconProps } from './Icon.types';

/**
 * Every glyph in Flux, drawn from one set through one component.
 *
 * The set is Hugeicons, which draws its icons as data rather than as a component each — so a caller
 * names the icon it wants and this decides how it is drawn. That indirection is the point: the free
 * set is one style, the licensed set is nine, and swapping between them is a change to this file and
 * the package it imports rather than to six hundred call sites.
 *
 * `whenActive` is how a glyph says a thing is in force — the filled twin of an outline. The free set
 * has no filled twins, so today an active icon is the same shape drawn heavier; the seam is here and
 * ready rather than scattered through the screens that will want it.
 *
 * @param of - Which icon, named from the icon package.
 * @param whenActive - The icon to draw instead while what it stands for is in force.
 * @param isActive - Whether what it stands for is in force.
 * @param size - How large, in pixels.
 * @param strokeWidth - How heavy the stroke is, which is the free set's only way to say emphasis.
 * @param className - Extra classes for the caller's own layout.
 * @param label - What it means in words, for a glyph that is not beside its own label.
 */
const Icon = ({
  of,
  whenActive,
  isActive = false,
  size = 18,
  strokeWidth,
  className,
  label,
}: IconProps) => (
  <HugeiconsIcon
    icon={of}
    {...(whenActive === undefined ? {} : { altIcon: whenActive, showAlt: isActive })}
    size={size}
    {...(strokeWidth === undefined ? { strokeWidth: isActive ? 2.4 : 1.8 } : { strokeWidth })}
    {...(className === undefined ? {} : { className })}
    {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
  />
);

Icon.displayName = 'Icon';

export { Icon };
