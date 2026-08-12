import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import { FLUX_TOKENS } from '@FluxUI/tokens';
import type { HoverHighlightProps } from './HoverHighlight.types';

const RADIUS_CLASSES = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  card: 'rounded-xl',
  nested: 'rounded-[1.375rem]',
  pill: 'rounded-full',
} as const;

/**
 * The background that follows the pointer.
 *
 * Drawn once behind a group rather than once per item, and moved. It is
 * deliberately not a child of the thing it highlights: a background that lives
 * inside a row cannot travel to the next one, and travelling is the point.
 *
 * It fades in where the pointer arrived rather than sliding in from wherever
 * it was last, since sliding across a menu nobody was pointing at reads as the
 * page doing something on its own.
 */
const HoverHighlight = ({ rect, radius = 'md', className }: HoverHighlightProps) => {
  const prefersReducedMotion = useReducedMotion();
  const isStill = prefersReducedMotion === true;

  return (
    <AnimatePresence>
      {rect === null ? null : (
        <motion.span
          aria-hidden
          className={cn('pointer-events-none absolute z-0', RADIUS_CLASSES[radius], className)}
          initial={{ opacity: 0, ...rect }}
          animate={{ opacity: 1, ...rect }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: isStill ? 0 : FLUX_TOKENS.duration.fast },
            default: isStill
              ? { duration: 0 }
              : { duration: FLUX_TOKENS.duration.normal, ease: FLUX_TOKENS.ease.soft },
          }}
        />
      )}
    </AnimatePresence>
  );
};

HoverHighlight.displayName = 'HoverHighlight';

export { HoverHighlight };
