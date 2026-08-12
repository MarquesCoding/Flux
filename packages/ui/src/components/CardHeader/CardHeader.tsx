import { cn } from '@FluxUI/cn';
import type { CardHeaderProps } from './CardHeader.types';

/**
 * The bar across the top of a card.
 *
 * One height for all of them, held by a minimum rather than by padding, so a
 * card carrying a search field and a card carrying only a word still line up
 * across a page. Every table in Flux wears one, which is what stops one panel
 * announcing itself an inch taller than the one beside it.
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
