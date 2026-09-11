import type { ReactNode } from 'react';

type DialogTitleProps = {
  title: string;
  detail?: string;
  icon?: ReactNode;
  below?: ReactNode;
  children?: ReactNode;
  size?: 'default' | 'compact';
  className?: string;
};

export type { DialogTitleProps };
