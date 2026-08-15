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
 * Picks the variants to animate with.
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

const STAGGER_STEP = 0.045;

const STAGGER_CEILING = 0.42;

/**
 * How long the card at a given place waits before it arrives.
 */
const staggerDelay = (index: number): number => Math.min(index * STAGGER_STEP, STAGGER_CEILING);

const groupVariants: Variants = { hidden: {}, shown: {}, gone: {} };

/**
 * One card of a list, arriving after the ones before it.
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
