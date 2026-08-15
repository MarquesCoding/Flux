import type { ReactElement } from 'react';

type ControlProperties = Record<string, string | number | boolean | object | null | undefined>;

type TooltipProps = {
  label: string;
  children: ReactElement<ControlProperties>;
  side?: 'top' | 'bottom' | 'left' | 'right';
  isDisabled?: boolean;
  delayMilliseconds?: number;
};

export type { ControlProperties, TooltipProps };
