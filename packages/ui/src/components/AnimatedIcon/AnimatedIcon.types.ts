import type { ReactNode } from 'react';

type IconGesture = 'spin' | 'ring' | 'tumble' | 'fill' | 'settle';

type AnimatedIconProps = {
  gesture?: IconGesture;
  isPlaying: boolean;
  icon: ReactNode;
  activeIcon?: ReactNode;
};

export type { AnimatedIconProps, IconGesture };
