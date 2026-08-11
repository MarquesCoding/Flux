import { cn } from '@FluxUI/cn';
import type { MeterProps } from './Meter.types';

/**
 * How much of something is being used.
 *
 * The bar carries the shape of the answer and the words carry the answer
 * itself, because a bar alone cannot say whether it is eighty percent of a
 * gigabyte or of a terabyte. Colour shifts as it fills: something running near
 * its limit should look different at a glance from something idling.
 */
const Meter = ({ label, fraction, value, className }: MeterProps) => {
  const filled = Math.min(Math.max(fraction, 0), 1);
  const tone = filled > 0.9 ? 'bg-danger' : filled > 0.7 ? 'bg-amber-400' : 'bg-accent';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-text-muted">{label}</span>
        <span className="text-sm tabular-nums text-text">{value}</span>
      </div>

      <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          role="presentation"
          style={{ width: `${(filled * 100).toString()}%` }}
          className={cn(
            'block h-full rounded-full transition-[width,background-color] duration-500',
            tone,
          )}
        />
      </span>
    </div>
  );
};

Meter.displayName = 'Meter';

export { Meter };
