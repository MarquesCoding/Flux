import { cn } from '@FluxUI/cn';
import type { GlassElevation, GlassPanelProps } from './GlassPanel.types';

const ELEVATION_CLASSES: Record<GlassElevation, string> = {
  floating: 'flux-glass',
  inset: 'border border-white/10 bg-white/[0.04] backdrop-blur-xl',
};

/**
 * A translucent pane.
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
