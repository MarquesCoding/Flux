type SparklineProps = {
  /**
   * The readings, oldest first.
   */
  values: number[];
  /**
   * The value a full-height column represents.
   */
  ceiling: number;
  label: string;
  className?: string;
};

export type { SparklineProps };
