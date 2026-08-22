import type { ReactNode } from 'react';

type SettingRowProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  isMarked?: boolean;
  className?: string;
};

export type { SettingRowProps };
