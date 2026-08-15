import { Meter as BaseMeter } from '@base-ui/react/meter';
import { cn } from '@FluxUI/cn';
import type { MeterProps } from './Meter.types';

/**
 * How much of something is being used.
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
