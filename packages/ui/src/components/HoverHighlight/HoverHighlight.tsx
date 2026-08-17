import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import { FLUX_TOKENS } from '@FluxUI/tokens';
import type { HoverHighlightProps } from './HoverHighlight.types';

const RADIUS_CLASSES = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  card: 'rounded-lg',
  nested: 'rounded-[1.375rem]',
  pill: 'rounded-full',
} as const;

/**
 * The single background that follows a pointer down a menu or a table, moving between rows rather
 * than appearing on each in turn. Takes the position measured by whatever owns the rows, since only
 * that knows where they are.
 *
 * @param rect - Where the highlight should sit, or null to show none at all.
 * @param radius - How round its corners are, which should match the rows it moves between.
 * @param className - Extra classes for the caller's own layout.
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
