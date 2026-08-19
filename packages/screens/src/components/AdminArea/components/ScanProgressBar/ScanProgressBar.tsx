import { cn } from '@FluxUI/cn';
import type { ScanProgressBarProps } from './ScanProgressBar.types';

const PHASE_LABELS: Record<string, string> = {
  probing: 'Probing',
  previews: 'Generating previews',
  trickplay: 'Generating scrub previews',
  segments: 'Finding intros',
};

/**
 * How far through a scan something actually is: which stage it has reached, and how many files it has
 * got through where it is counting them. A scan that reports no counts still shows movement rather
 * than an empty bar, since the absence of a count is not the absence of progress.
 *
 * @param label - What is being worked on.
 * @param phase - The stage it has reached, where it reports one.
 * @param processed - How many files it has got through, where it counts them.
 * @param total - How many there are in all, where that is known.
 */
const ScanProgressBar = ({ label, phase, processed, total }: ScanProgressBarProps) => {
  const isKnown = processed !== null && total !== null;
  const fraction = !isKnown || total === 0 ? 0 : Math.min(processed / total, 1);
  const isEmpty = isKnown && total === 0;
  const phaseLabel = phase === null ? null : (PHASE_LABELS[phase] ?? phase);

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

      <span className="block h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <span
          style={isKnown && !isEmpty ? { width: `${(fraction * 100).toString()}%` } : undefined}
          className={cn(
            'block h-full rounded-full bg-accent',
            isKnown ? 'transition-[width] duration-300' : 'w-full animate-pulse',
            isEmpty ? 'w-full' : '',
          )}
        />
      </span>

      {isKnown && !isEmpty ? (
        <span className="shrink-0 text-xs tabular-nums text-text-muted">
          {processed}/{total}
        </span>
      ) : null}
    </div>
  );
};

ScanProgressBar.displayName = 'ScanProgressBar';

export { ScanProgressBar };
