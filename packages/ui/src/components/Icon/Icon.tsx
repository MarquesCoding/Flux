import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@ValenceUI/cn';
import type { IconProps } from './Icon.types';

const RESTING = 1.75;

const IN_FORCE = 2.25;

const BASE_TEXT_PX = 16;

/**
 * Every glyph in Valence, drawn from one set through one component.
 *
 * A caller names the icon it wants and this decides how it is drawn. That indirection is the point,
 * and it has earned itself more than once: the set behind this has changed, and every place that
 * draws an icon changed nothing but the name it asked for.
 *
 * A glyph at rest is drawn a little heavier than the set's own line, so it still holds over artwork,
 * and a glyph in force heavier again. That is a second cue rather than the only one: the free set
 * has no filled drawings, so whether a thing is on is said first by the control that holds it. Where
 * the pair is two ideas rather than one switched on — play and pause — `whenActive` names the other
 * drawing, and it is swapped in place rather than drawn beside.
 *
 * @param of - The icon.
 * @param whenActive - The drawing to show instead while in force, where that is a different idea.
 * @param isActive - Whether the thing it stands for is on.
 * @param size - How large it is, in pixels at the base text size. It is drawn in rem, so it grows
 *   with the text on a large screen rather than staying the size it was drawn for a small one.
 * @param className - Extra classes for the caller's own layout.
 * @param label - What it means, where nothing beside it says; without one it is hidden from
 *   assistive technology, since the words beside it already say it.
 */
const Icon = ({ of, whenActive, isActive = false, size = 18, className, label }: IconProps) => (
  <HugeiconsIcon
    icon={of}
    {...(whenActive === undefined ? {} : { altIcon: whenActive, showAlt: isActive })}
    size={`${(size / BASE_TEXT_PX).toString()}rem`}
    strokeWidth={isActive ? IN_FORCE : RESTING}
    className={cn('valence-icon', className)}
    {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
  />
);

Icon.displayName = 'Icon';

export { IN_FORCE, RESTING, Icon };
