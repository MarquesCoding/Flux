import { cn } from '@FluxUI/cn'
import type { ScanProgressBarProps } from './ScanProgressBar.types'

/**
 * What the server calls a phase, in words an operator reads.
 */
const PHASE_LABELS: Record<string, string> = {
  probing: 'Probing',
  previews: 'Generating previews',
  segments: 'Finding intros',
}

/**
 * How far through a scan actually is.
 *
 * Filled by a real fraction once the current phase has counted its files,
 * rather than an animation standing in for one. Labelled with the phase
 * itself so a bar that reaches the end of probing and starts again at zero
 * reads as moving on to the next stage, not as stalled.
 */
const ScanProgressBar = ({ label, phase, processed, total }: ScanProgressBarProps) => {
  const isKnown = processed !== null && total !== null && total > 0
  const fraction = isKnown ? Math.min(processed / total, 1) : 0
  const phaseLabel = phase === null ? null : (PHASE_LABELS[phase] ?? phase)

  return (
    <div
      role="progressbar"
      aria-label={phaseLabel === null ? label : `${label}: ${phaseLabel}`}
      {...(isKnown
        ? { 'aria-valuenow': processed, 'aria-valuemin': 0, 'aria-valuemax': total }
        : {})}
      className="flex shrink-0 items-center gap-2"
    >
      {phaseLabel === null ? null : (
        <span className="shrink-0 text-xs text-text-muted">{phaseLabel}</span>
      )}

      <span className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
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

export { ScanProgressBar }
