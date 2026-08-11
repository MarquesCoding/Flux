import type { ReactNode } from 'react';

type TabsProps = {
  /**
   * Which tab is showing. The bar and the panels both read this, so neither
   * has to be told separately which of them is in force.
   */
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export type { TabsProps };
