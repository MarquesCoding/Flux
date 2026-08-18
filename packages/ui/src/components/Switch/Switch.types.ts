import type { ReactNode } from 'react';

type SwitchProps = {
  label: string;
  isOn: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'overlay';
  className?: string;
};

export type { SwitchProps };
