import type { ReactElement, ReactNode } from 'react';

type TabPanelProps = {
  value: string;
  children: ReactNode;
  render?: ReactElement;
  travel?: 1 | -1;
  className?: string;
};

export type { TabPanelProps };
