import type { ReactNode } from 'react';

type DialogCompanionProps = {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export type { DialogCompanionProps };
