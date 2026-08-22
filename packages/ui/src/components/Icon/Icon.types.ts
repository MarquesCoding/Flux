import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';

type IconProps = {
  of: PhosphorIcon;
  whenActive?: PhosphorIcon;
  isActive?: boolean;
  size?: number;
  weight?: IconWeight;
  className?: string;
  label?: string;
};

export type { IconProps };
