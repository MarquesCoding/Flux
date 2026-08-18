import type { IconSvgElement } from '@hugeicons/react';

type IconProps = {
  of: IconSvgElement;
  whenActive?: IconSvgElement;
  isActive?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
};

export type { IconProps };
