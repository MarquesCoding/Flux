import type { ReactNode } from 'react';

type ScrolledTitleProps = {
  title: string;
  artwork?: string | null;
  detail?: ReactNode;
  isShowing: boolean;
  children?: ReactNode;
};

export type { ScrolledTitleProps };
