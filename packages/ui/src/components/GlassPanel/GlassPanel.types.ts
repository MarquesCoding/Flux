import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/**
 * How solid the pane reads.
 *
 * `floating` is for something resting over content — a bar, a menu, a dialog.
 * `inset` is for something carved into the page, which wants less lift and no
 * shadow beneath it.
 */
type GlassElevation = 'floating' | 'inset';

type GlassPanelProps = Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'> & {
  children: ReactNode;
  elevation?: GlassElevation;
  /**
   * What this renders as. A pane is a shape, not a meaning: it might be a
   * `section`, an `aside` or a plain `div` depending on what it holds.
   */
  as?: ElementType;
  className?: string;
};

export type { GlassElevation, GlassPanelProps };
