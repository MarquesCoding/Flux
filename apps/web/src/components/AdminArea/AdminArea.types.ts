type AdminAreaProps = {
  /**
   * How many readings of the machine are kept on screen.
   *
   * A minute at one a second. Long enough to see a transcode start and settle,
   * short enough that the shape of now is not lost in the shape of earlier.
   */
  historyLength?: number;
  /**
   * Which panel to open on first render, read from the address.
   *
   * Unrecognised or absent falls back to the first panel, the same as
   * picking a panel the address bar has never heard of.
   */
  initialPanel?: string | null;
  /**
   * Told whenever the panel changes, so the address can be kept in step and
   * a reload lands back on the same one.
   */
  onPanelChange?: (panel: string) => void;
  /**
   * Which job's schedule page to open on first render, read from the
   * address the same way `initialPanel` is.
   */
  initialJob?: string | null;
  /**
   * Told whenever the open job's schedule page changes — including closing
   * it, reported as null — so the address can be kept in step.
   */
  onJobChange?: (kind: string | null) => void;
};

export type { AdminAreaProps };
