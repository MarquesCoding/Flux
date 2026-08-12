import type { ReactNode } from 'react';

type StatTileProps = {
  /**
   * What is being measured.
   */
  label: string;
  /**
   * The figure itself, already in whatever units it is read in.
   */
  value: string;
  /**
   * Said under the figure: what it is out of, or what it is doing.
   */
  detail?: string;
  icon?: ReactNode;
  /**
   * How full, from nought to one. Absent draws no bar, which is right for a
   * figure that is a count rather than a proportion.
   */
  fraction?: number;
  /**
   * A reading history to draw behind the figure.
   */
  history?: ReactNode;
  className?: string;
};

export type { StatTileProps };
