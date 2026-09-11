import type { MotionValue } from 'motion/react';

type PageDotsProps = {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  labels?: string[];
  label?: string;
  className?: string;
  progress?: MotionValue<number>;
  tone?: 'page' | 'overlay';
};

export type { PageDotsProps };
