import type { ReactNode } from 'react';

type ProgressBarProps = {
  label: string;
  value: number | null;
  max?: number;
  children?: ReactNode;
  readout?: ReactNode;
  className?: string;
};

export type { ProgressBarProps };
