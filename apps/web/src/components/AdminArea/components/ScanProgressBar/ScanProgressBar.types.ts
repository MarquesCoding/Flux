type ScanProgressBarProps = {
  label: string;
  /**
   * What the scan is doing right now — probing files, then generating
   * trickplay and previews. Shown to the left of the bar so it is obvious
   * the job moved on rather than stalled once one stage finishes.
   */
  phase: string | null;
  /**
   * How far into the current phase the scan is.
   *
   * Null until that phase has counted its files — which is also true for the
   * instant it starts — so the bar has something honest to show before there
   * is a fraction to show it with.
   */
  processed: number | null;
  total: number | null;
};

export type { ScanProgressBarProps };
