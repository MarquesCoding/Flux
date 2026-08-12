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
 *
 * The only place a panel's material is decided. Before this, three hundred
 * files each chose their own rounding, their own hairline and their own tint,
 * which is why some surfaces were glass and some were not for no reason a
 * viewer could see. A card that wants to look different says which tone it is,
 * and the tones are a closed set.
 *
 * It is a box and not a button: a card that can be pressed puts a `Button`
 * inside itself rather than becoming one, because a pressable div is a button
 * that has forgotten its keyboard.
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
