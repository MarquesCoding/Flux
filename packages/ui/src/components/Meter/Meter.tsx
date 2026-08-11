import { Meter as BaseMeter } from '@base-ui/react/meter';
import { cn } from '@FluxUI/cn';
import type { MeterProps } from './Meter.types';

/**
 * How much of something is being used.
 *
 * The bar carries the shape of the answer and the words carry the answer
 * itself, because a bar alone cannot say whether it is eighty percent of a
 * gigabyte or of a terabyte. Colour shifts as it fills: something running near
 * its limit should look different at a glance from something idling.
 *
 * Built on Base UI's meter, so it is a `meter` to anything reading the page
 * rather than a decorated `div`: the fraction is announced, and the words
 * beside it are its label and its value rather than two unrelated spans.
 */
const Meter = ({ label, fraction, value, className }: MeterProps) => {
  const filled = Math.min(Math.max(fraction, 0), 1);
  const tone = filled > 0.9 ? 'bg-danger' : filled > 0.7 ? 'bg-amber-400' : 'bg-accent';

  return (
    <BaseMeter.Root
      value={filled * 100}
      getAriaValueText={() => value}
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <BaseMeter.Label className="text-xs uppercase tracking-[0.16em] text-text-muted">
          {label}
        </BaseMeter.Label>
        <BaseMeter.Value className="text-sm tabular-nums text-text">{() => value}</BaseMeter.Value>
      </div>

      <BaseMeter.Track className="block h-1.5 overflow-hidden rounded-full bg-white/10">
        <BaseMeter.Indicator
          className={cn(
            'block h-full rounded-full transition-[width,background-color] duration-500',
            tone,
          )}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
};

Meter.displayName = 'Meter';

export { Meter };
