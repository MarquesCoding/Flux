import type { ElementType, HTMLAttributes, ReactNode } from 'react';

type CardTone = 'raised' | 'glass' | 'plain';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardRadius = 'md' | 'lg' | 'xl';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  /**
   * What the card is made of.
   *
   * `raised` is the ordinary one: a solid surface with a hairline and a soft
   * shadow. `glass` is for surfaces floating over artwork, and is deliberately
   * rare — glass everywhere reads as fog. `plain` is a shape with no material,
   * for a card whose contents supply their own background.
   */
  tone?: CardTone;
  padding?: CardPadding;
  radius?: CardRadius;
  /**
   * Whether resting a pointer on the card lifts it.
   *
   * For a card that is itself a way somewhere. A card that only holds figures
   * should not move under the pointer, since nothing happens when it is
   * pressed.
   */
  isInteractive?: boolean;
  /**
   * The element to draw, for a card that is a list item or a section.
   */
  as?: ElementType;
};

export type { CardPadding, CardProps, CardRadius, CardTone };
