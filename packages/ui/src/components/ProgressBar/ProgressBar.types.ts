import type { ReactNode } from 'react';

type ProgressBarProps = {
  /**
   * What is making progress, in words. Kept for readers rather than drawn: the
   * bar sits beside text that already says what it is.
   */
  label: string;
  /**
   * How far along, or `null` when that is not yet known.
   *
   * Told apart deliberately. A bar that fills from nought because nothing has
   * been counted yet claims progress it cannot see; `null` says so, and the bar
   * paces instead of filling.
   */
  value: number | null;
  /**
   * What counts as finished. Defaults to a hundred, for a percentage.
   */
  max?: number;
  /**
   * Drawn before the bar, for a stage that has a name.
   */
  children?: ReactNode;
  /**
   * Drawn after the bar, for the count a bar cannot give: a bar says how far,
   * and this says how far through what.
   */
  readout?: ReactNode;
  className?: string;
};

export type { ProgressBarProps };
