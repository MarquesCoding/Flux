import type { ReactNode } from 'react';

type RailProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  onOpenTitle?: () => void;
  sizesCards?: boolean | undefined;
  cards?: 'wide' | 'portrait' | undefined;
  className?: string;
};

export type { RailProps };
