type HistoryPanelProps = {
  /**
   * What counts as now, for saying how long ago something was watched.
   *
   * Passed in so a test can say what "yesterday" means instead of waiting a
   * day for it.
   */
  now?: Date;
};

export type { HistoryPanelProps };
