import type { Transition, Variants } from 'motion/react';

/**
 * The spring everything moves on.
 *
 * Springs rather than durations because a spring carries weight: it settles
 * where it is going instead of arriving at a fixed moment, which is what
 * separates an interface that feels physical from one that feels timed.
 */
const spring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

/**
 * A gentler spring for anything large.
 *
 * A hero moving on the same spring as a button reads as flapping: the bigger
 * the object, the longer it should take to settle.
 */
const heavySpring: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 30,
  mass: 1.1,
};

/**
 * The spring a moving highlight travels on.
 *
 * Damped just short of springing back, so the highlight flows to its new place
 * and stops there. A slacker spring reads as bouncy rather than as liquid, and
 * a bar that wobbles every time it is used gets tiring quickly.
 */
const liquidSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 34,
  mass: 1,
};

/**
 * How something containing text changes size.
 *
 * A tween rather than a spring, because a spring overshoots and text that
 * overshoots is text that jitters. This arrives and stops.
 */
const settleTween: Transition = {
  duration: 0.32,
  ease: [0.2, 0, 0, 1],
};

/**
 * What a reduced-motion preference gets instead.
 *
 * Not "no animation": an element that snaps into place is harder to follow
 * than one that fades. What is removed is the movement, not the transition.
 */
const stillTransition: Transition = { duration: 0.18, ease: 'easeOut' };

/**
 * How far something travels as it arrives.
 */
const RISE = 18;

/**
 * Text and blocks arriving from below.
 *
 * The distance is small on purpose. Something that flies in from off screen
 * announces the animation; something that lifts slightly announces the
 * content.
 */
const riseVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  shown: { opacity: 1, y: 0 },
  gone: { opacity: 0, y: -RISE },
};

/**
 * The same, without the movement.
 */
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1 },
  gone: { opacity: 0 },
};

/**
 * A container whose children arrive one after another.
 *
 * The stagger is what makes a page read as composed rather than dumped: the
 * eye follows the order the designer intended instead of meeting everything at
 * once.
 */
const staggerVariants: Variants = {
  hidden: {},
  shown: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
  gone: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

/**
 * Picks the variants to animate with.
 *
 * Called with whatever `useReducedMotion` reported, so the decision is made
 * once at the call site rather than being guessed at in every component.
 */
const revealVariants = (prefersReducedMotion: boolean | null): Variants =>
  prefersReducedMotion === true ? fadeVariants : riseVariants;

/**
 * Picks the transition to move on.
 */
const revealTransition = (
  prefersReducedMotion: boolean | null,
  weight: 'light' | 'heavy' = 'light',
): Transition => {
  if (prefersReducedMotion === true) {
    return stillTransition;
  }

  return weight === 'heavy' ? heavySpring : spring;
};

/**
 * How long between one card of a list arriving and the next.
 */
const STAGGER_STEP = 0.045;

/**
 * The longest anything waits its turn.
 *
 * A row holds a whole programme and a grid holds a whole library, so index
 * times step alone would have the hundredth card arriving a quarter of a
 * minute after the first — long after somebody has scrolled to where it should
 * be and found a gap. Past this point the rest arrive together, which nobody
 * notices because by then the eye has already been led.
 */
const STAGGER_CEILING = 0.42;

/**
 * How long the card at a given place waits before it arrives.
 */
const staggerDelay = (index: number): number => Math.min(index * STAGGER_STEP, STAGGER_CEILING);

/**
 * A group whose children arrive in order, each on a delay of its own.
 *
 * Nothing here moves. It exists to hand the word `shown` down to the cards
 * inside it, which is how a list of any length arrives as one gesture without
 * every card having to be told when its own turn is.
 */
const groupVariants: Variants = { hidden: {}, shown: {}, gone: {} };

/**
 * One card of a list, arriving after the ones before it.
 *
 * The delay comes from the card's own place in the list rather than from the
 * group counting its children, because a group's stagger has no ceiling: it
 * multiplies right to the end of a library. Told its index through `custom`.
 */
const revealItemVariants = (prefersReducedMotion: boolean | null): Variants => ({
  hidden: prefersReducedMotion === true ? { opacity: 0 } : { opacity: 0, y: RISE },
  shown: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { ...revealTransition(prefersReducedMotion), delay: staggerDelay(index) },
  }),
  gone: (index: number) => ({
    opacity: 0,
    y: prefersReducedMotion === true ? 0 : -RISE,
    transition: { ...stillTransition, delay: staggerDelay(index) / 2 },
  }),
});

export {
  spring,
  heavySpring,
  liquidSpring,
  settleTween,
  stillTransition,
  riseVariants,
  fadeVariants,
  staggerVariants,
  groupVariants,
  revealItemVariants,
  revealVariants,
  revealTransition,
  staggerDelay,
  RISE,
  STAGGER_STEP,
  STAGGER_CEILING,
};
