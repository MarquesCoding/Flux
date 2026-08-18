import type { ReactNode } from 'react';

type RailProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  onOpenTitle?: () => void;
  className?: string;
};

export type { RailProps };
