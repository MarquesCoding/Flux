import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type EpisodeRowProps = {
  episode: MediaSummary;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect?: (media: MediaSummary) => void;
  watchedFraction?: number;
  resumeSeconds?: number;
};

export type { EpisodeRowProps };
