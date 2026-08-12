import type { HighlightRect } from '@FluxUI/useSlidingHighlight';

type HoverHighlightProps = {
  /**
   * Where to sit. Null hides it, which is what a pointer leaving means.
   */
  rect: HighlightRect | null;
  /**
   * How round the moving background is. Matches whatever it is sliding over.
   *
   * `nested` is the radius of a thing sitting inside a rounded box with a
   * hair of padding — the outer curve less that padding, so the two curves are
   * concentric rather than one cutting across the other.
   */
  radius?: 'xs' | 'sm' | 'md' | 'card' | 'nested' | 'pill';
  className?: string;
};

export type { HoverHighlightProps };
