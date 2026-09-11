import { cn } from '@ValenceUI/cn';
import type { GlassElevation, GlassPanelProps } from './GlassPanel.types';

const ELEVATION_CLASSES: Record<GlassElevation, string> = {
  floating: 'valence-float',
  inset: 'border border-line bg-subtle backdrop-blur-xl',
};

/**
 * Draws a pane of glass — translucent, blurred, with a hairline edge — which is the surface the
 * platform floats things on: the dock, the player's controls, popovers. What passes beneath stays
 * visible, so the page belongs to what is being shown and the interface rests on top of it.
 *
 * @param children - What the pane holds.
 * @param elevation - How far off the page it reads, which sets the blur and the edge.
 * @param as - The element to render as, where a plain division is not the right thing.
 * @param className - Extra classes for the caller's own layout.
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
);

GlassPanel.displayName = 'GlassPanel';

export { GlassPanel };
