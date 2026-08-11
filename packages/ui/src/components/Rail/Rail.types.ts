import type { ReactNode } from 'react';

type RailProps = {
  title: string;
  children: ReactNode;
  /**
   * Shown at the end of the heading, for a row that continues elsewhere.
   */
  action?: ReactNode;
  /**
   * What the heading is a way into, when it names something a viewer can open.
   * A row headed with a programme's name is read as a way to that programme;
   * given this, the heading becomes a control that says so.
   */
  onOpenTitle?: () => void;
  className?: string;
};

export type { RailProps };
