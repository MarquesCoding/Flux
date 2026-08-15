import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { SlidingMarkProps } from './SlidingMark.types';

/**
 * How the mark travels between controls.
 *
 * A spring rather than a duration: it is following a pointer, and a pointer
 * does not move on a curve somebody chose in advance. Stiff enough to keep up
 * with a quick pass along a row, damped enough not to wobble when it lands.
 */
const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * The one highlight in a row of controls, which travels rather than reappears.
 *
 * Rendered inside whichever control is currently lit; because every one of
 * them names the same group, moving it from one to the next animates the mark
 * across instead of fading one out and another in. That is the whole point: a
 * highlight that jumps reads as two highlights taking turns, where one that
 * slides reads as a single thing being moved — which is what a viewer is
 * actually doing.
 *
 * It sits behind its control and answers to nobody: the control keeps the
 * press, the label and the focus ring, and this is only the paint.
 *
 * Still for somebody who asked the system for less movement, arriving where it
 * belongs without the journey.
 */
const SlidingMark = ({ group, className }: SlidingMarkProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      layoutId={group}
      data-mark={group}
      transition={prefersReducedMotion === true ? { duration: 0 } : MARK_MOTION}
      className={cn('absolute inset-0 -z-10 rounded-full bg-[var(--surface-active)]', className)}
    />
  );
};

SlidingMark.displayName = 'SlidingMark';

export { SlidingMark };
