import type { ReactNode } from 'react';
import type { IconGesture } from '@FluxUI/AnimatedIcon.types';

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
  /**
   * How the icon moves when it is pointed at.
   *
   * Named here rather than decided by the dock, because what a movement should
   * say depends on what the place is, which is the one thing the dock does not
   * know about its items.
   */
  gesture?: IconGesture;
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
  gesture?: IconGesture;
  /**
   * Whether this reads as the current place. Search is both a tool and a page.
   */
  isCurrent?: boolean;
  badge?: ReactNode;
} & (
  | {
      /**
       * A control to draw in place of the button, for a tool that opens
       * something where it stands. Drawn as given: a button inside a button is
       * not a thing a browser will make sense of.
       *
       * The dock renders this and nothing else, so there is no press of its own
       * to answer — hence no `onSelect` alongside it. Asking for a callback
       * that can never fire only invites a stub nobody reads.
       */
      control: ReactNode;
      onSelect?: never;
    }
  | {
      control?: undefined;
      onSelect: () => void;
    }
);

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
