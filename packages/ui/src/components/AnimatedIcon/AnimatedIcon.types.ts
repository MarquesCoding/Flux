import type { ReactNode } from 'react';

type IconGesture = 'spin' | 'ring' | 'tumble' | 'fill' | 'settle' | 'none';

type AnimatedIconProps = {
  gesture?: IconGesture;
  isPlaying: boolean;
  isStilled?: boolean;
  icon: ReactNode;
  activeIcon?: ReactNode;
};

export type { AnimatedIconProps, IconGesture };
