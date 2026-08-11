type ScanProgressBarProps = {
  label: string
  /**
   * How many files have been walked, and how many there are to walk.
   *
   * Null until the scan has counted its files — which is also true for the
   * instant it starts — so the bar has something honest to show before there
   * is a fraction to show it with.
   */
  processed: number | null
  total: number | null
}

export type { ScanProgressBarProps }
