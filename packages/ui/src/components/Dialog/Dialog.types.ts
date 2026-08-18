import type { ReactNode } from 'react';

type DialogSize = 'default' | 'stage';

type DialogProps = {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  className?: string;
};

export type { DialogProps, DialogSize };
