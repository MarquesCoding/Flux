import type { ReactNode } from 'react';

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export type { TabsProps };
