type AdminAreaProps = {
  /**
   * How many readings of the machine are kept on screen.
   *
   * A minute at one a second. Long enough to see a transcode start and settle,
   * short enough that the shape of now is not lost in the shape of earlier.
   */
  historyLength?: number;
};

export type { AdminAreaProps };
