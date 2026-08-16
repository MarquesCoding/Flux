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
 * An icon that answers a pointer with a movement saying what pressing it would do — the cog turns,
 * the bell rings, the heart fills. A row of icons is a row of nouns until one of them moves, and
 * the movement is what turns the mark into the verb it stands for. Nothing moves at all for
 * somebody who has asked their system for less movement.
 *
 * @param gesture - How it should move, defaulting to a small rise and nothing else.
 * @param isPlaying - Whether the gesture should be running, which the surrounding control decides.
 * @param isStilled - Whether to put the icon back where it rests without animating it there. Merely
 *   stopping a gesture animates it back, and that return journey moves the icon as much as the
 *   gesture did — which is no use to anything anchored to it. The element itself is kept, since
 *   replacing it would unmount whatever it wraps, and a popover whose trigger is unmounted shuts.
 * @param icon - The icon as it rests.
 * @param activeIcon - Its filled twin, which the filling gestures reveal over it.
 */
const AnimatedIcon = ({
  gesture = 'settle',
  isPlaying,
  isStilled = false,
  icon,
  activeIcon,
}: AnimatedIconProps) => {
  const prefersReducedMotion = useReducedMotion();
  const wipe = WIPES[gesture];

  if (prefersReducedMotion === true) {
    return <span className="flex shrink-0 items-center">{icon}</span>;
  }

  const settling = isStilled ? { duration: 0 } : undefined;

  return (
    <motion.span
      initial="rest"
      animate={isPlaying && !isStilled ? 'play' : 'rest'}
      variants={GESTURES[gesture]}
      {...(settling === undefined ? {} : { transition: settling })}
      className={cn(
        'relative flex shrink-0 items-center',
        gesture === 'ring' ? 'origin-top' : 'origin-center',
      )}
    >
      {icon}

      {wipe === undefined || activeIcon === undefined ? null : (
        <motion.span
          variants={wipe}
          {...(settling === undefined ? {} : { transition: settling })}
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
