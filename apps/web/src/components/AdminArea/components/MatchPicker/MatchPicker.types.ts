import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MatchPickerProps = {
  /**
   * The thing whose match is wrong. An episode stands for its whole series,
   * because the id being corrected names a programme rather than an episode.
   */
  media: MediaSummary | null;
  onClose: () => void;
  /**
   * Told once the correction is saved, with the job reading the files again.
   *
   * Null when no queue took the work, which means it has already happened.
   */
  onCorrected: (jobId: string | null) => void;
};

export type { MatchPickerProps };
