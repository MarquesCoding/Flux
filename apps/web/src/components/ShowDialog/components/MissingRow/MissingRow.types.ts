type MissingRowProps = {
  episodeNumber: number;
  /**
   * What the episode is called, when the catalogue said. A viewer looking at a
   * gap wants to know which episode it is, not that a number is absent.
   */
  title?: string;
  /**
   * The catalogue's own still. Not one of ours: there is no file to take a
   * frame from, which is the point.
   */
  stillUrl?: string | null;
};

export type { MissingRowProps };
