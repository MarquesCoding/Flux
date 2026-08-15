import type { ReactNode } from 'react';

/**
 * What an icon does when it is pointed at.
 *
 * Named for the movement rather than for the icon, so that two things which
 * move the same way share one entry: a cog and a refresh arrow both `spin`.
 *
 * `settle` is the quiet one — a small rise and nothing else — and is what
 * anything unnamed gets. An icon whose movement would say nothing about what
 * it does is better still than busy.
 */
type IconGesture = 'spin' | 'ring' | 'tumble' | 'fill' | 'settle';

type AnimatedIconProps = {
  gesture?: IconGesture;
  /**
   * Whether the gesture should be playing — pointed at, or focused.
   *
   * Driven from outside rather than from a hover of its own, because the thing
   * being pointed at is the control around the icon, which is bigger than the
   * icon and is what a pointer actually arrives at.
   */
  isPlaying: boolean;
  icon: ReactNode;
  /**
   * The filled twin of the same mark, for the gesture that fills.
   *
   * `fill` reveals this over the icon rather than crossfading to it, which is
   * what makes a heart look like it is filling rather than like two hearts
   * dissolving into each other. Left out, the gesture falls back to its
   * movement alone.
   */
  activeIcon?: ReactNode;
};

export type { AnimatedIconProps, IconGesture };
