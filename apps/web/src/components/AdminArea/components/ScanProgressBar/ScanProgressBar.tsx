import { ProgressBar } from '@FluxUI/ProgressBar';
import type { ScanProgressBarProps } from './ScanProgressBar.types';

/**
 * What the server calls a phase, in words an operator reads.
 */
const PHASE_LABELS: Record<string, string> = {
  probing: 'Probing',
  previews: 'Generating previews',
  segments: 'Finding intros',
};

/**
 * How far through a scan actually is.
 *
 * Filled by a real fraction once the current phase has counted its files,
 * rather than an animation standing in for one. Labelled with the phase
 * itself so a bar that reaches the end of probing and starts again at zero
 * reads as moving on to the next stage, not as stalled.
 */
const ScanProgressBar = ({ label, phase, processed, total }: ScanProgressBarProps) => {
  const isKnown = processed !== null && total !== null && total > 0;
  const phaseLabel = phase === null ? null : (PHASE_LABELS[phase] ?? phase);

  return (
    <ProgressBar
      label={phaseLabel === null ? label : `${label}: ${phaseLabel}`}
      value={isKnown ? processed : null}
      {...(isKnown ? { max: total } : {})}
      {...(isKnown
        ? {
            readout: (
              <span className="shrink-0 text-xs tabular-nums text-text-muted">
                {processed}/{total}
              </span>
            ),
          }
        : {})}
    >
      {phaseLabel === null ? null : (
        <span aria-hidden className="shrink-0 text-xs text-text-muted">
          {phaseLabel}
        </span>
      )}
    </ProgressBar>
  );
};

ScanProgressBar.displayName = 'ScanProgressBar';

export { ScanProgressBar };
