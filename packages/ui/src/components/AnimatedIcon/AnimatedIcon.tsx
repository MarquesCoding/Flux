import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { Variants } from 'motion/react';
import type { AnimatedIconProps, IconGesture } from './AnimatedIcon.types';

/**
 * How each gesture moves.
 *
 * Every one of them ends where it started, so an icon that is passed over
 * quickly is not left leaning: the resting state is the drawing as it was, and
 * a pointer that leaves mid-gesture is animated back to it rather than cut.
 *
 * The one exception is `spin`, which holds at half a turn while it is being
 * pointed at and unwinds on the way out. A cog that snapped back would read as
 * a cog that had failed to turn.
 */
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

/**
 * How the filled twin arrives, for the gesture that fills.
 *
 * A wipe rather than a fade, rising from the bottom the way something fills
 * up — a heart with what is kept in it, a flame catching. A clip path, so the
 * icon underneath is never moved or scaled by the reveal.
 */
const WIPES: Partial<Record<IconGesture, Variants>> = {
  fill: {
    rest: { clipPath: 'inset(100% 0% 0% 0%)' },
    play: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.45, ease: 'easeOut' } },
  },
};

/**
 * An icon that answers a pointer.
 *
 * A row of icons is a row of nouns until one of them moves; the movement is
 * what turns the mark into the verb it stands for. So the gesture is chosen to
 * say what pressing would do — the cog turns, the bell rings, the dice tumbles
 * — rather than to be decoration that happens to be attached to an icon.
 *
 * Nothing here moves for somebody who asked the system for less movement. The
 * icon is drawn plainly instead, which is the whole feature absent rather than
 * a version of it running at half speed.
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
