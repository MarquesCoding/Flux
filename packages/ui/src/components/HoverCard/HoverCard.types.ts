import type { ReactNode } from 'react';

type HoverCardProps = {
  /**
   * What resting on opens the card.
   */
  children: ReactNode;
  /**
   * What the card says.
   */
  detail: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
};

export type { HoverCardProps };
