import type { ReactNode } from 'react';

type SwitchProps = {
  /**
   * What the switch turns on, in words. Always present: a track with a knob on
   * it says nothing about what it does.
   */
  label: string;
  isOn: boolean;
  onToggle: () => void;
  /**
   * Drawn before the label, for a row in a menu of settings.
   */
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * Whether the switch is painted for a panel laid over video, where the page's
   * own colours say nothing about what is behind it.
   */
  tone?: 'default' | 'overlay';
  className?: string;
};

export type { SwitchProps };
