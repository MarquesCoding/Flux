import type { ReactNode } from 'react';

type ReadMoreProps = {
  children: ReactNode;
  lines?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
};

export type { ReadMoreProps };
