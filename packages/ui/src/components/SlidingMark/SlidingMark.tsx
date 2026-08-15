import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { SlidingMarkProps } from './SlidingMark.types';

const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * The one highlight in a row of controls, which travels rather than reappears.
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
