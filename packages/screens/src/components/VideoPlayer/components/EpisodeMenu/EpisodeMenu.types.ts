import type { MediaSummary } from '@FluxContracts/schemas/Library';

type EpisodeMenuProps = {
  episodes: MediaSummary[];
  playingId: string;
  onSelect: (episode: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  onOpenChange?: (isOpen: boolean) => void;
  isDisabled?: boolean;
};

export type { EpisodeMenuProps };
