import cnModule from '@FluxUI/cn'
import type { GlassElevation, GlassPanelProps } from './GlassPanel.types'

const { cn } = cnModule

const ELEVATION_CLASSES: Record<GlassElevation, string> = {
  floating: 'flux-glass',
  inset: 'border border-white/10 bg-white/[0.04] backdrop-blur-xl',
}

/**
 * A translucent pane.
 *
 * The one place the glass treatment is defined, so every bar, menu and card
 * that floats over content catches the light the same way. Composed rather
 * than themed: what goes inside is the caller's business, the material is
 * this component's.
 */
const GlassPanel = ({
  children,
  elevation = 'floating',
  as: Element = 'div',
  className,
  ...rest
}: GlassPanelProps) => (
  <Element className={cn('rounded-xl', ELEVATION_CLASSES[elevation], className)} {...rest}>
    {children}
  </Element>
)

GlassPanel.displayName = 'GlassPanel'

export default { GlassPanel }
