import type { ReactNode } from 'react';

type ActionMenuItem = {
  id: string;
  label: string;
  /**
   * Drawn before the label. An action reads faster with a mark against it.
   */
  icon?: ReactNode;
  /**
   * Said quietly after the label, for a shortcut or a count.
   */
  detail?: string;
  /**
   * Whether choosing this destroys something.
   *
   * Coloured rather than merely listed last, since a menu is read by scanning
   * and the one item worth hesitating over should be the one that stands out.
   */
  isDestructive?: boolean;
  isDisabled?: boolean;
  onChoose: () => void;
};

type ActionMenuGroup = {
  /**
   * Unnamed groups are separated by a rule rather than a heading, for a menu
   * whose divisions need no explaining.
   */
  name?: string;
  items: ActionMenuItem[];
};

type ActionMenuProps = {
  /**
   * What the menu is called, for whoever cannot see it.
   */
  label: string;
  /**
   * The control that opens it.
   */
  trigger: ReactNode;
  groups: ActionMenuGroup[];
  align?: 'start' | 'center' | 'end';
  isDisabled?: boolean;
  className?: string;
};

export type { ActionMenuGroup, ActionMenuItem, ActionMenuProps };
