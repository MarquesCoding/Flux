import { RiLoader4Line } from '@remixicon/react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import { spinVariants, spinTransition, reducedSpinTransition } from '@FluxUI/animations/spin';
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
  const prefersReducedMotion = useReducedMotion();

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
      <RiLoader4Line size={SIZE_PIXELS[size]} aria-hidden />
    </motion.span>
  );
};

Spinner.displayName = 'Spinner';

export { Spinner };
