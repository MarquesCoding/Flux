import type { ReactNode } from 'react';

type PanelCardProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  isFlush?: boolean;
  className?: string;
};

export type { PanelCardProps };
