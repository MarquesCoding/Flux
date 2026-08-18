import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaFactsProps = {
  media: MediaSummary;
  className?: string;
  hasRuntime?: boolean;
  hasEpisode?: boolean;
};

export type { MediaFactsProps };
