import type { ReactNode } from 'react';

type RailProps = {
  title: string;
  children: ReactNode;
  /**
   * Shown at the end of the heading, for a row that continues elsewhere.
   */
  action?: ReactNode;
  className?: string;
};

export type { RailProps };
