import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import DotFieldModule from '@FluxUI/DotField'
import type { MoodBackgroundProps } from './MoodBackground.types'

const { DotField } = DotFieldModule

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
const MoodBackground = ({ color, hasGrid = false, isDrifting = false }: MoodBackgroundProps) => {
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
          <div
            style={style}
            className={[
              'flux-mood',
              hasGrid ? 'flux-mood--grid' : '',
              isDrifting ? 'flux-mood--drift' : '',
            ]
              .filter((name) => name !== '')
              .join(' ')}
          />
        </motion.div>
      </AnimatePresence>

      {/* Outside the fading layer on purpose. The wash is rebuilt whenever the
          colour changes, and rebuilding a field of two thousand elements in
          the middle of a transition is what makes that transition stutter.
          The dots belong to the page, not to the colour it happens to be. */}
      {!hasGrid ? null : <DotField />}
    </div>
  )
}

MoodBackground.displayName = 'MoodBackground'

export default { MoodBackground }
