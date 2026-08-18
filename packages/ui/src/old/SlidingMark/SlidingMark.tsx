import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { SlidingMarkProps } from './SlidingMark.types';

const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * The single highlight in a row of controls, which travels between them rather than disappearing
 * and reappearing — a highlight that jumps reads as two highlights taking turns, where one that
 * slides reads as a single thing being moved, which is what a viewer is actually doing. Sits behind
 * its control and answers to nobody: the control keeps the press, the label and the focus ring.
 *
 * @param group - Which row this mark belongs to; one mark travels between every control naming the same group, so two rows on a page need two names.
 * @param className - The shape to take, where a row is not made of pills.
 */
const SlidingMark = ({ group, className }: SlidingMarkProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      layoutId={group}
      data-mark={group}
      transition={prefersReducedMotion === true ? { duration: 0 } : MARK_MOTION}
      className={cn('absolute inset-0 -z-10 rounded-md bg-[var(--surface-active)]', className)}
    />
  );
};

SlidingMark.displayName = 'SlidingMark';

export { SlidingMark };
