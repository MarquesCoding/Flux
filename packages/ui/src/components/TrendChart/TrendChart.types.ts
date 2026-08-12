type TrendChartProps = {
  /**
   * The readings, oldest first. The last one is now.
   */
  values: number[];
  /**
   * What counts as full. Readings are drawn as a share of this.
   */
  ceiling: number;
  /**
   * What the whole drawing is, for whoever cannot see it.
   */
  label: string;
  /**
   * Drawn along the bottom, from oldest to newest.
   */
  caption?: string;
  className?: string;
};

export type { TrendChartProps };
