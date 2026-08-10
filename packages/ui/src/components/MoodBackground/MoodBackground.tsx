import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { MoodBackgroundProps } from './MoodBackground.types'

/**
 * Inline styles that may carry the custom property the wash reads.
 *
 * React's own style type knows nothing about custom properties, and the wash
 * is defined in CSS so that a colour change animates rather than repainting
 * from JavaScript.
 */
type MoodStyle = CSSProperties & { '--color-mood'?: string }

/**
 * The atmosphere behind the page.
 *
 * Fixed behind everything and lit from two directions, so scrolling moves the
 * content through the light rather than dragging the light with it. The colour
 * comes from whatever is on screen, which is what makes the shell feel like it
 * belongs to the thing being shown rather than to the application.
 *
 * A change of colour is a crossfade of two whole layers rather than a
 * transition on one. CSS cannot interpolate a gradient — a browser asked to
 * animate between two of them simply swaps, which reads as the page blinking
 * every time the hero moves on. Two stacked layers, the new one fading in over
 * the old, is the only way to actually dissolve between them.
 */
const MoodBackground = ({ color, hasGrid = false }: MoodBackgroundProps) => {
  const prefersReducedMotion = useReducedMotion()
  const shown = color === null || color === undefined || color === '' ? null : color
  const style: MoodStyle = shown === null ? {} : { '--color-mood': shown }

  return (
    <div role="presentation" className="pointer-events-none fixed inset-0 -z-10">
      <AnimatePresence initial={false}>
        {/* The fading layer carries no colour of its own: the custom property
            the wash reads is not something the animation library's style type
            admits, so it lives on a plain element inside. */}
        <motion.div
          key={shown ?? 'none'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion === true ? 0 : 0.9, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <div style={style} className={hasGrid ? 'flux-mood flux-mood--grid' : 'flux-mood'} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

MoodBackground.displayName = 'MoodBackground'

export default { MoodBackground }
