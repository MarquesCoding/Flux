import type { ReactNode } from 'react';

type ActionBarAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onChoose: () => void;
};

type ActionBarProps = {
  label: string;
  primary: ReactNode;
  actions: readonly ActionBarAction[];
  className?: string;
};

export type { ActionBarAction, ActionBarProps };
