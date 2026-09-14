import { Icon } from '@ValenceUI/Icon';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '@ValenceUI/cn';
import { spinVariants, spinTransition, reducedSpinTransition } from '@ValenceUI/animations/spin';
import type { SpinnerProps, SpinnerSize } from './Spinner.types';

const SIZE_PIXELS: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

/**
 * Shows that something is happening without claiming to know how far along it is. The label is
 * required rather than optional: a spinner is invisible to anybody not looking at the screen, and
 * this is the only thing that says what is being waited for.
 *
 * @param size - How large to draw it, from a line of text to the middle of a page.
 * @param label - What is being waited for, read out and shown to anybody hovering.
 * @param className - Extra classes for the caller's own layout.
 */
const Spinner = ({ size = 'md', label, className }: SpinnerProps) => {
  const prefersReducedMotion = useReducedMotionConfig();

  return (
    <motion.span
      role="status"
      aria-label={label}
      className={cn('inline-flex text-current', className)}
      variants={spinVariants}
      initial="idle"
      animate={prefersReducedMotion === true ? 'idle' : 'spinning'}
      transition={prefersReducedMotion === true ? reducedSpinTransition : spinTransition}
    >
      <Icon of={Loading03Icon} size={SIZE_PIXELS[size]} />
    </motion.span>
  );
};

Spinner.displayName = 'Spinner';

export { Spinner };
