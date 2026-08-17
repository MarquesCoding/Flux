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
  className?: string;
};

export type { PopoverPanelProps };
