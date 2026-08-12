type MatchCorrectionProps = {
  mediaId: string;
  /**
   * Whether this item is an episode, which decides what a correction means:
   * an id names a programme, so correcting one episode corrects its series.
   */
  isEpisode: boolean;
  /**
   * Told once a correction has been saved and the files read again, so the
   * page can show what it now says.
   */
  onCorrected: () => void;
};

export type { MatchCorrectionProps };
