import type { ReactNode } from 'react';

type PopoverPanelProps = {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  heading?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  isDisabled?: boolean;
  isBare?: boolean;
  tone?: 'default' | 'overlay';
  className?: string;
};

export type { PopoverPanelProps };
