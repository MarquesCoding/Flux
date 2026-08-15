import { cn } from '@FluxUI/cn';
import type { CardPadding, CardProps, CardRadius, CardTone } from './Card.types';

const TONE_CLASSES: Record<CardTone, string> = {
  raised: 'flux-surface',
  glass: 'flux-glass',
  plain: '',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const RADIUS_CLASSES: Record<CardRadius, string> = {
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
};

/**
 * A surface that holds something.
 */
const Card = ({
  children,
  tone = 'raised',
  padding = 'md',
  radius = 'lg',
  isInteractive = false,
  as: Element = 'div',
  className,
  ...rest
}: CardProps) => (
  <Element
    className={cn(
      'relative',
      RADIUS_CLASSES[radius],
      TONE_CLASSES[tone],
      PADDING_CLASSES[padding],
      isInteractive ? 'flux-hoverable flux-lift cursor-pointer' : '',
      className,
    )}
    {...rest}
  >
    {children}
  </Element>
);

Card.displayName = 'Card';

export { Card };
