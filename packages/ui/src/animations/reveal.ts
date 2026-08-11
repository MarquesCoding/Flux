import type { Transition, Variants } from 'motion/react'

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
}

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
}

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
}

/**
 * How something containing text changes size.
 *
 * A tween rather than a spring, because a spring overshoots and text that
 * overshoots is text that jitters. This arrives and stops.
 */
const settleTween: Transition = {
  duration: 0.32,
  ease: [0.2, 0, 0, 1],
}

/**
 * What a reduced-motion preference gets instead.
 *
 * Not "no animation": an element that snaps into place is harder to follow
 * than one that fades. What is removed is the movement, not the transition.
 */
const stillTransition: Transition = { duration: 0.18, ease: 'easeOut' }

/**
 * How far something travels as it arrives.
 */
const RISE = 18

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
}

/**
 * The same, without the movement.
 */
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1 },
  gone: { opacity: 0 },
}

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
}

/**
 * Picks the variants to animate with.
 *
 * Called with whatever `useReducedMotion` reported, so the decision is made
 * once at the call site rather than being guessed at in every component.
 */
const revealVariants = (prefersReducedMotion: boolean | null): Variants =>
  prefersReducedMotion === true ? fadeVariants : riseVariants

/**
 * Picks the transition to move on.
 */
const revealTransition = (
  prefersReducedMotion: boolean | null,
  weight: 'light' | 'heavy' = 'light',
): Transition => {
  if (prefersReducedMotion === true) {
    return stillTransition
  }

  return weight === 'heavy' ? heavySpring : spring
}

export default {
  spring,
  heavySpring,
  liquidSpring,
  settleTween,
  stillTransition,
  riseVariants,
  fadeVariants,
  staggerVariants,
  revealVariants,
  revealTransition,
  RISE,
}
