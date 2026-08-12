import type { ReactNode } from 'react';

type DialogTitleProps = {
  /**
   * What the dialog is for, in a few words.
   */
  title: string;
  /**
   * The line under it: what choosing something here will do.
   */
  detail?: string;
  /**
   * Drawn at the right of the heading, for a control that belongs to the whole
   * dialog rather than to its content.
   */
  children?: ReactNode;
  className?: string;
};

export type { DialogTitleProps };
