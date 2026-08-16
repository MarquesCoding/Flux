import type { ReactNode } from 'react';

type SliderTone = 'default' | 'overlay';

type SliderProps = {
  label: string;
  value: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  renderPreview?: (value: number) => ReactNode;
  tone?: SliderTone;
  className?: string;
};

export type { SliderProps, SliderTone };
