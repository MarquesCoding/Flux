import type { ReactNode } from 'react';

/**
 * One place the bar can take a viewer.
 */
type TopNavItem = {
  id: string;
  label: string;
  /**
   * The mark shown beside the label while this is the place being stood on.
   *
   * Only then. Five icons in a row is a rebus somebody has to decode every
   * time; one icon, on the word that is already lit, is a badge.
   */
  icon?: ReactNode;
};

/**
 * One thing the bar can do that is not going somewhere.
 *
 * Searching, notifications, the account: drawn as icons at the right, apart
 * from the places, because they are tools rather than destinations.
 */
type TopNavAction = {
  id: string;
  label: string;
  icon: ReactNode;
  /**
   * Whether this reads as the current place.
   *
   * Search is both a tool and a page, and the one the viewer is standing on
   * should say so.
   */
  isCurrent?: boolean;
  /**
   * Something to draw over the icon — an unread count, a face.
   */
  badge?: ReactNode;
  /**
   * A control to draw in place of the button.
   *
   * For tools that open something where they stand rather than going
   * somewhere. Drawn as given: a button inside a button is not a thing a
   * browser will make sense of.
   */
  control?: ReactNode;
  onSelect: () => void;
};

type TopNavProps = {
  /**
   * The mark, at the left. A bar with nothing on the left is a row of links
   * floating in a strip.
   */
  brand?: ReactNode;
  items: TopNavItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions?: TopNavAction[];
  className?: string;
};

export type { TopNavAction, TopNavItem, TopNavProps };
