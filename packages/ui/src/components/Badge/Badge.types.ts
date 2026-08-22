import type { ReactNode } from 'react';

type BadgeTone = 'quiet' | 'accent' | 'success' | 'highlight' | 'solid' | 'warning' | 'danger';

type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
};

export type { BadgeProps, BadgeSize, BadgeTone };
