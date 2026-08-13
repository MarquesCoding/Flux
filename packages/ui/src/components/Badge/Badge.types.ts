import type { ReactNode } from 'react';

/**
 * How much attention a badge asks for.
 *
 * `quiet` is the default because most badges state a fact — a resolution, a
 * codec — and a screen of shouting labels states nothing. `accent` is for the
 * one that matters, and `solid` for a badge sitting on artwork, where
 * translucency would leave it unreadable.
 */
/**
 * `warning` is for a fact that is working but costly — a deliberate choice
 * worth a second look. `danger` is for one that is not working at all.
 */
type BadgeTone = 'quiet' | 'accent' | 'solid' | 'warning' | 'danger';

type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
};

export type { BadgeProps, BadgeSize, BadgeTone };
