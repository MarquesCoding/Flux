import type { ReactElement, ReactNode } from 'react';

type TabPanelProps = {
  value: string;
  children: ReactNode;
  render?: ReactElement;
  className?: string;
};

export type { TabPanelProps };
