import type { ReactElement, ReactNode } from 'react';

type TabPanelProps = {
  /**
   * Which tab this belongs to, matching that tab's id.
   */
  value: string;
  children: ReactNode;
  /**
   * What to render as, for a panel that wants to be something other than a
   * plain box — a `motion.section` that fades itself in, most often.
   */
  render?: ReactElement;
  className?: string;
};

export type { TabPanelProps };
