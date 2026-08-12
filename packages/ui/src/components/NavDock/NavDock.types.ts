import type { ReactNode } from 'react';

/**
 * One place the dock can take a viewer.
 */
type NavDockItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /**
   * Drawn instead of the icon while this is the place being stood on.
   *
   * A filled version of the same mark: the shape stays put and only its weight
   * changes, so nothing about the dock moves as you arrive.
   */
  activeIcon?: ReactNode;
};

/**
 * One thing the dock can do that is not going somewhere.
 */
type NavDockAction = {
  id: string;
  label: string;
  icon: ReactNode;
  /**
   * Drawn instead of the icon while this reads as the current place.
   */
  activeIcon?: ReactNode;
  /**
   * Whether this reads as the current place. Search is both a tool and a page.
   */
  isCurrent?: boolean;
  badge?: ReactNode;
  /**
   * A control to draw in place of the button, for a tool that opens something
   * where it stands. Drawn as given: a button inside a button is not a thing a
   * browser will make sense of.
   */
  control?: ReactNode;
  onSelect: () => void;
};

type NavDockProps = {
  /**
   * The mark, at the head of the dock.
   */
  brand?: ReactNode;
  items: NavDockItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions?: NavDockAction[];
  className?: string;
};

export type { NavDockAction, NavDockItem, NavDockProps };
