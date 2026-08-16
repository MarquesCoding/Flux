import type { Transition, Variants } from 'motion/react';

const spring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

const heavySpring: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 30,
  mass: 1.1,
};

const liquidSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 34,
  mass: 1,
};

const settleTween: Transition = {
  duration: 0.32,
  ease: [0.2, 0, 0, 1],
};

const stillTransition: Transition = { duration: 0.18, ease: 'easeOut' };

const RISE = 18;

const riseVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  shown: { opacity: 1, y: 0 },
  gone: { opacity: 0, y: -RISE },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1 },
  gone: { opacity: 0 },
};

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
 * Picks how something should arrive: rising into place, or simply fading, for somebody who has
 * asked their system for less movement. The two are kept as separate variant sets rather than one
 * set with the distance zeroed, so a reduced-motion arrival is a deliberate design rather than a
 * broken one.
 *
 * @param prefersReducedMotion - What the system reports, which is null until it has been read.
 * @returns The variants to hand a Motion component.
 */
const revealVariants = (prefersReducedMotion: boolean | null): Variants =>
  prefersReducedMotion === true ? fadeVariants : riseVariants;

/**
 * Picks the curve something moves on. Reduced motion gets no duration at all, so the end state
 * simply is. The heavier spring is for the large things — a page, a hero — which look wrong
 * arriving as fast as a card does.
 *
 * @param prefersReducedMotion - What the system reports, which is null until it has been read.
 * @param weight - Whether this is a large thing arriving or an ordinary one.
 * @returns The transition to hand a Motion component.
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

const STAGGER_STEP = 0.045;

const STAGGER_CEILING = 0.42;

/**
 * Works out how long the card at a given place in a row waits before arriving, so a row assembles
 * left to right rather than appearing at once. The wait stops growing past a ceiling: a row of
 * forty would otherwise still be arriving long after somebody had started reading it.
 *
 * @param index - Where the card sits in the row, counting from zero.
 * @returns How long to wait, in seconds.
 */
const staggerDelay = (index: number): number => Math.min(index * STAGGER_STEP, STAGGER_CEILING);

const groupVariants: Variants = { hidden: {}, shown: {}, gone: {} };

/**
 * Builds the variants for one card of a row, each arriving after the one before it and leaving in
 * the same order at twice the speed. Leaving faster than arriving is deliberate: an exit that takes
 * as long as an entrance reads as the interface hesitating.
 *
 * @param prefersReducedMotion - What the system reports, which is null until it has been read.
 * @returns The variants to hand a Motion component, which take the card's index.
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
};
