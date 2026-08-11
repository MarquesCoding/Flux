import { IconLoader2 } from '@tabler/icons-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@FluxUI/cn'
import { spinVariants, spinTransition, reducedSpinTransition } from '@FluxUI/animations/spin'
import type { SpinnerProps, SpinnerSize } from './Spinner.types'

const SIZE_PIXELS: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

/**
 * An indeterminate loading indicator.
 *
 * Honours `prefers-reduced-motion` by holding still rather than spinning, per
 * code standards section 11.
 */
const Spinner = ({ size = 'md', label, className }: SpinnerProps) => {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.span
      role="status"
      aria-label={label}
      className={cn('inline-flex text-current', className)}
      variants={spinVariants}
      initial="idle"
      animate={prefersReducedMotion === true ? 'idle' : 'spinning'}
      transition={prefersReducedMotion === true ? reducedSpinTransition : spinTransition}
    >
      <IconLoader2 size={SIZE_PIXELS[size]} stroke={2} aria-hidden />
    </motion.span>
  )
}

Spinner.displayName = 'Spinner'

export { Spinner }
