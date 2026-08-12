import type { ReactNode } from 'react';

type CardHeaderProps = {
  /**
   * What the card holds, in small capitals.
   */
  title: string;
  /**
   * Drawn at the right: a search field, a count, or the actions for the whole
   * card. Controls belong here rather than loose above the card.
   */
  children?: ReactNode;
  className?: string;
};

export type { CardHeaderProps };
