import { cn } from '@ValenceUI/cn';
import type { MeterProps } from './Meter.types';

/**
 * Shows how much of a fixed thing is in use — disk, cache, quota — as a bar with the figure written
 * beside it. The fraction draws the bar and the value is what a reader actually takes away, so both
 * are given rather than one being derived from the other and rounded twice.
 *
 * @param label - What is being measured.
 * @param fraction - How full it is, from nothing to one.
 * @param value - The amount as it should be read, such as `1.4 GB of 2 GB`.
 * @param className - Extra classes for the caller's own layout.
 */
const Meter = ({ label, fraction, value, className }: MeterProps) => {
  const filled = Math.min(Math.max(fraction, 0), 1);
  const tone = filled > 0.9 ? 'bg-destructive' : filled > 0.7 ? 'bg-amber-400' : 'bg-primary';

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(filled * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={value}
      data-slot="meter"
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-text-muted">{label}</span>
        <span className="text-sm tabular-nums text-text">{value}</span>
      </div>

      <span className="block h-1.5 overflow-hidden rounded-full bg-track">
        <span
          style={{ width: `${(filled * 100).toString()}%` }}
          className={cn(
            'block h-full rounded-full',
            'transition-[width,background-color] duration-[var(--duration-slow)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none',
            tone,
          )}
        />
      </span>
    </div>
  );
};

Meter.displayName = 'Meter';

export { Meter };
