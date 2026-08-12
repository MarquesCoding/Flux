import type { ReactNode } from 'react';

type SideNavItem = {
  id: string;
  label: string;
  /**
   * Drawn before the label. Optional, because a group of two does not need
   * pictures to be told apart.
   */
  icon?: ReactNode;
  /**
   * A count or a state worth seeing without opening the section — how many
   * things need attention, how many are running.
   */
  badge?: ReactNode;
};

type SideNavGroup = {
  /**
   * What the group is called, or null for items that sit above the first
   * heading. A single item does not always deserve a heading of its own.
   */
  label: string | null;
  items: SideNavItem[];
};

type SideNavProps = {
  groups: SideNavGroup[];
  label: string;
  className?: string;
};

export type { SideNavItem, SideNavGroup, SideNavProps };
