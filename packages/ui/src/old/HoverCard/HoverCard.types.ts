import type { ReactNode } from 'react';

type HoverCardProps = {
  children: ReactNode;
  detail: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
};

export type { HoverCardProps };
