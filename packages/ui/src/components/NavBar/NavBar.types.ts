import type { ReactNode } from 'react';
import type { MotionValue } from 'motion/react';
import type { IconGesture } from '@ValenceUI/AnimatedIcon.types';

type NavBarItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  activeIcon?: ReactNode;
  gesture?: IconGesture;
};

type NavBarAction = {
  id: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
  gesture?: IconGesture;
  isCurrent?: boolean;
  badge?: ReactNode;
} & (
  | {
      control: ReactNode;
      onSelect?: never;
    }
  | {
      control?: undefined;
      onSelect: () => void;
    }
);

type NavBarProps = {
  brand?: ReactNode;
  items: NavBarItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions?: NavBarAction[];
  solidity?: MotionValue<number> | number;
  className?: string;
};

export type { NavBarAction, NavBarItem, NavBarProps };
