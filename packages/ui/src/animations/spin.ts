import type { Transition, Variants } from 'motion/react'

const spinVariants: Variants = {
  idle: { rotate: 0 },
  spinning: { rotate: 360 },
}

const spinTransition: Transition = {
  duration: 0.9,
  repeat: Number.POSITIVE_INFINITY,
  ease: 'linear',
}

const reducedSpinTransition: Transition = {
  duration: 0,
  repeat: 0,
}

export default { spinVariants, spinTransition, reducedSpinTransition }
