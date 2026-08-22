import type { ReactNode } from 'react';
import type { IconGesture } from '@ValenceUI/AnimatedIcon.types';

type NavDockItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  activeIcon?: ReactNode;
  gesture?: IconGesture;
};

type NavDockAction = {
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

type NavDockProps = {
  brand?: ReactNode;
  items: NavDockItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions?: NavDockAction[];
  className?: string;
};

export type { NavDockAction, NavDockItem, NavDockProps };
