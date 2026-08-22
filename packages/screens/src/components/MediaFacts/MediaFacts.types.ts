import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type MediaFactsProps = {
  media: MediaSummary;
  className?: string;
  hasRuntime?: boolean;
  hasEpisode?: boolean;
};

export type { MediaFactsProps };
