import type { ReactNode } from 'react';

type RailProps = {
  title: string;
  children: ReactNode;
  count?: number;
  action?: ReactNode;
  onOpenTitle?: () => void;
  sizesCards?: boolean | undefined;
  cards?: 'wide' | 'portrait' | undefined;
  hasArrows?: boolean | undefined;
  className?: string;
};

export type { RailProps };
