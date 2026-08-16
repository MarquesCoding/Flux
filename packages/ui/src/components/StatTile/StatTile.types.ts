import type { ReactNode } from 'react';

type StatTileProps = {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  fraction?: number;
  history?: ReactNode;
  className?: string;
};

export type { StatTileProps };
