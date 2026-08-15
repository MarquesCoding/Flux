import { cn } from '@FluxUI/cn';
import type { CardHeaderProps } from './CardHeader.types';

/**
 * The bar across the top of a card.
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
