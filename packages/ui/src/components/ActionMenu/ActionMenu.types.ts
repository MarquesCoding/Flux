import type { ReactNode } from 'react';

type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  detail?: string;
  isDestructive?: boolean;
  isDisabled?: boolean;
  keepsOpen?: boolean;
  onChoose: () => void;
};

type ActionMenuGroup = {
  name?: string;
  items: ActionMenuItem[];
};

type ActionMenuProps = {
  label: string;
  trigger: ReactNode;
  groups: ActionMenuGroup[];
  align?: 'start' | 'center' | 'end';
  isDisabled?: boolean;
  className?: string;
};

export type { ActionMenuProps };
