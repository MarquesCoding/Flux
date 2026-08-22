import type { HighlightRect } from '@ValenceUI/useSlidingHighlight';

type HoverHighlightProps = {
  rect: HighlightRect | null;
  radius?: 'xs' | 'sm' | 'md' | 'card' | 'nested' | 'pill';
  className?: string;
};

export type { HoverHighlightProps };
