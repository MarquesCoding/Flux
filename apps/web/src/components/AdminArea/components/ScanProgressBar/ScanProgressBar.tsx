import type { ScanProgressBarProps } from './ScanProgressBar.types'

/**
 * Shows that a scan is under way.
 *
 * Fills without a fraction because a scan does not report one: nothing about
 * walking a directory says how far through it is until it is done. What this
 * says is that it is still going, not how much is left.
 */
const ScanProgressBar = ({ label }: ScanProgressBarProps) => (
  <div role="progressbar" aria-label={label} className="flex w-32 shrink-0 flex-col justify-center">
    <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
      <span className="block h-full w-full animate-pulse rounded-full bg-accent" />
    </span>
  </div>
)

ScanProgressBar.displayName = 'ScanProgressBar'

export default { ScanProgressBar }
