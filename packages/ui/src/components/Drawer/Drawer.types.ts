import type { ReactNode } from 'react';

type DrawerProps = {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export type { DrawerProps };
