import type { ReactNode } from 'react';

type RevealItemProps = {
  children: ReactNode;
  /**
   * Where this one sits in the list, which is what decides its turn.
   *
   * Given rather than counted, because the group above holds no count: a row
   * and a grid both hand their cards straight to this, and asking a parent to
   * number them is the parent knowing something it has no other use for.
   */
  index: number;
  className?: string;
};

export type { RevealItemProps };
