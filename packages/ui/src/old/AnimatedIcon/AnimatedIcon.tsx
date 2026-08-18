import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@FluxUI/cn';
import type { Variants } from 'motion/react';
import type { AnimatedIconProps, IconGesture } from './AnimatedIcon.types';

const ANSWER = { type: 'spring', bounce: 0, duration: 0.25 } as const;

const GESTURES: Record<IconGesture, Variants> = {
  spin: {
    rest: { transform: 'rotate(0deg)', transition: ANSWER },
    play: { transform: 'rotate(180deg)', transition: ANSWER },
  },
  ring: {
    rest: { transform: 'rotate(0deg)', transition: ANSWER },
    play: { transform: 'rotate(-14deg)', transition: ANSWER },
  },
  tumble: {
    rest: { transform: 'translateY(0px) rotate(0deg)', transition: ANSWER },
    play: { transform: 'translateY(-2px) rotate(-10deg)', transition: ANSWER },
  },
  fill: {
    rest: { transform: 'scale(1)', transition: ANSWER },
    play: { transform: 'scale(1.12)', transition: ANSWER },
  },
  settle: {
    rest: { transform: 'translateY(0px)', transition: ANSWER },
    play: { transform: 'translateY(-2px)', transition: ANSWER },
  },
};

const WIPES: Partial<Record<IconGesture, Variants>> = {
  fill: {
    rest: { clipPath: 'inset(100% 0% 0% 0%)', transition: ANSWER },
    play: { clipPath: 'inset(0% 0% 0% 0%)', transition: ANSWER },
  },
};

/**
 * An icon that answers a pointer with a movement saying what pressing it would do — the cog turns,
 * the bell tilts, the heart fills. A row of icons is a row of nouns until one of them moves, and the
 * movement is what turns the mark into the verb it stands for. Nothing moves at all for somebody who
 * has asked their system for less movement.
 *
 * Each answer is one move rather than a performance. These sit in the dock, which somebody crosses
 * dozens of times a day, and at that frequency the rule runs the other way from the usual one: the
 * more often a movement is seen, the shorter and smaller it has to be. A bell that rang for
 * seven hundred milliseconds every time a pointer passed it was a half-second of the interface
 * being busy on its own behalf.
 *
 * They are springs rather than sequences of frames for the same reason. A row of icons is crossed in
 * one sweep, and a spring asked to go somewhere else mid-flight carries its speed into the new
 * answer, where a sequence starts again from the beginning and the row stutters.
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
