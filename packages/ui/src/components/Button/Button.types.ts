import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant =
  'primary' | 'glossy' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'overlay' | 'link' | 'bare';

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isPill?: boolean;
  label?: string;
  isIconOnly?: boolean;
  isActive?: boolean;
  hasTooltip?: boolean;
  tooltipDelayMilliseconds?: number;
  className?: string;
};

export type { ButtonProps, ButtonVariant, ButtonSize };
