import { cn } from '@ValenceUI/cn';
import type { CardPadding, CardProps, CardRadius, CardTone } from './Card.types';

const TONE_CLASSES: Record<CardTone, string> = {
  raised: 'valence-surface',
  glass: 'valence-float',
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
 * Draws the surface that everything else sits on: a raised rectangle with the padding, corner and
 * tone the platform uses everywhere. Renders as whatever element the caller needs, so a card that
 * is one big press target is still a button underneath.
 *
 * @param children - What the card holds.
 * @param tone - How the surface is painted, from quiet to raised.
 * @param padding - How much room to leave inside it.
 * @param radius - How round the corners are.
 * @param isInteractive - Whether it lifts and lights under a pointer, for a card that is pressable.
 * @param as - The element to render as, where a plain division is not the right thing.
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
      isInteractive ? 'valence-hoverable valence-lift cursor-pointer' : '',
      className,
    )}
    {...rest}
  >
    {children}
  </Element>
);

Card.displayName = 'Card';

export { Card };
