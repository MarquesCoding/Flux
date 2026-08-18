import type { ReactNode } from 'react';

type FilePickerProps = {
  label: string;
  accept: string;
  onPick: (file: File) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

export type { FilePickerProps };
