import type { ElementType, HTMLAttributes, ReactNode } from 'react';

type CardTone = 'raised' | 'glass' | 'plain';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardRadius = 'md' | 'lg' | 'xl';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  tone?: CardTone;
  padding?: CardPadding;
  radius?: CardRadius;
  isInteractive?: boolean;
  as?: ElementType;
};

export type { CardPadding, CardProps, CardRadius, CardTone };
