import type { ReactNode } from 'react';

type MenuOption = {
  id: string;
  label: string;
  detail?: string;
};

type MenuGroup = {
  name: string;
  options: MenuOption[];
  selectedId: string;
  onSelect: (id: string) => void;
};

type OptionMenuProps = {
  label: string;
  trigger: ReactNode;
  groups: MenuGroup[];
  footer?: ReactNode;
  isDisabled?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  matchTriggerWidth?: boolean;
  triggerShape?: 'icon' | 'field';
};

export type { MenuGroup, OptionMenuProps };
