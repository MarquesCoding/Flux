import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { Variants } from 'motion/react';
import type { AnimatedIconProps, IconGesture } from './AnimatedIcon.types';

const GESTURES: Record<IconGesture, Variants> = {
  spin: {
    rest: { rotate: 0 },
    play: { rotate: 180, transition: { duration: 0.55, ease: 'easeInOut' } },
  },
  ring: {
    rest: { rotate: 0 },
    play: { rotate: [0, -16, 13, -9, 5, 0], transition: { duration: 0.7, ease: 'easeInOut' } },
  },
  tumble: {
    rest: { rotate: 0, y: 0 },
    play: {
      rotate: [0, -14, 14, -8, 0],
      y: [0, -2, 0, -1, 0],
      transition: { duration: 0.6, ease: 'easeInOut' },
    },
  },
  fill: {
    rest: { scale: 1 },
    play: { scale: [1, 1.18, 1], transition: { duration: 0.4, delay: 0.3, ease: 'easeOut' } },
  },
  settle: {
    rest: { y: 0 },
    play: { y: [0, -2, 0], transition: { duration: 0.45, ease: 'easeOut' } },
  },
};

const WIPES: Partial<Record<IconGesture, Variants>> = {
  fill: {
    rest: { clipPath: 'inset(100% 0% 0% 0%)' },
    play: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.45, ease: 'easeOut' } },
  },
};

/**
 * An icon that answers a pointer.
 */
const AnimatedIcon = ({ gesture = 'settle', isPlaying, icon, activeIcon }: AnimatedIconProps) => {
  const prefersReducedMotion = useReducedMotion();
  const wipe = WIPES[gesture];

  if (prefersReducedMotion === true) {
    return <span className="flex shrink-0 items-center">{icon}</span>;
  }

  return (
    <motion.span
      initial="rest"
      animate={isPlaying ? 'play' : 'rest'}
      variants={GESTURES[gesture]}
      className={cn(
        'relative flex shrink-0 items-center',
        gesture === 'ring' ? 'origin-top' : 'origin-center',
      )}
    >
      {icon}

      {wipe === undefined || activeIcon === undefined ? null : (
        <motion.span
          variants={wipe}
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          {activeIcon}
        </motion.span>
      )}
    </motion.span>
  );
};

AnimatedIcon.displayName = 'AnimatedIcon';

export { AnimatedIcon };
