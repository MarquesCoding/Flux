import { Progress } from '@base-ui/react/progress';
import { cn } from '@FluxUI/cn';
import type { ProgressBarProps } from './ProgressBar.types';

/**
 * How far through something long-running is.
 */
const ProgressBar = ({
  label,
  value,
  max = 100,
  children,
  readout,
  className,
}: ProgressBarProps) => (
  <Progress.Root
    value={value}
    max={max}
    className={cn('flex shrink-0 items-center gap-2', className)}
  >
    <Progress.Label className="sr-only">{label}</Progress.Label>

    {children}

    <Progress.Track className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
      <Progress.Indicator
        className={cn(
          'block h-full rounded-full bg-accent',
          value === null ? 'w-full animate-pulse' : 'transition-[width] duration-300',
        )}
      />
    </Progress.Track>

    {readout}
  </Progress.Root>
);

ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
