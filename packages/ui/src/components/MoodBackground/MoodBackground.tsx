import type { CSSProperties } from 'react'
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
 */
const MoodBackground = ({ color, hasGrid = false }: MoodBackgroundProps) => {
  const style: MoodStyle =
    color === null || color === undefined || color === '' ? {} : { '--color-mood': color }

  return (
    <div
      role="presentation"
      className={hasGrid ? 'flux-mood flux-mood--grid' : 'flux-mood'}
      style={style}
    />
  )
}

MoodBackground.displayName = 'MoodBackground'

export default { MoodBackground }
