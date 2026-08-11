import cnModule from '@FluxUI/cn'
import type { ScanProgressBarProps } from './ScanProgressBar.types'

const { cn } = cnModule

/**
 * How far through a scan actually is.
 *
 * Filled by a real fraction once the walk has counted its files, rather than
 * an animation standing in for one: an operator watching a library of ten
 * thousand files wants to know it is nearly there, not just that it is still
 * going.
 */
const ScanProgressBar = ({ label, processed, total }: ScanProgressBarProps) => {
  const isKnown = processed !== null && total !== null && total > 0
  const fraction = isKnown ? Math.min(processed / total, 1) : 0

  return (
    <div
      role="progressbar"
      aria-label={label}
      {...(isKnown
        ? { 'aria-valuenow': processed, 'aria-valuemin': 0, 'aria-valuemax': total }
        : {})}
      className="flex w-32 shrink-0 items-center gap-2"
    >
      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span
          style={isKnown ? { width: `${(fraction * 100).toString()}%` } : undefined}
          className={cn(
            'block h-full rounded-full bg-accent',
            isKnown ? 'transition-[width] duration-300' : 'w-full animate-pulse',
          )}
        />
      </span>

      {isKnown ? (
        <span className="shrink-0 text-xs tabular-nums text-text-muted">
          {processed}/{total}
        </span>
      ) : null}
    </div>
  )
}

ScanProgressBar.displayName = 'ScanProgressBar'

export default { ScanProgressBar }
