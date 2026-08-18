import { cn } from '@FluxUI/cn';
import type { CardHeaderProps } from './CardHeader.types';

/**
 * Draws the bar across the top of a card: the title on the left, and whatever the caller puts on
 * the right — a count, a menu, a button. Kept as its own component so every card's head is spaced
 * and weighted the same, rather than each one arranging its own.
 *
 * @param title - What the card is about.
 * @param children - What sits at the right of the bar.
 * @param className - Extra classes for the caller's own layout.
 */
const CardHeader = ({ title, children, className }: CardHeaderProps) => (
  <header
    className={cn(
      'flex min-h-16 flex-wrap items-center justify-between gap-3',
      'border-b border-[var(--surface-line)] px-4 py-3',
      className,
    )}
  >
    <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">{title}</h2>

    {children === undefined ? null : (
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    )}
  </header>
);

CardHeader.displayName = 'CardHeader';

export { CardHeader };
