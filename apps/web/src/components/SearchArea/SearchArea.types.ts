import type { MediaSummary } from '@FluxContracts/schemas/Library';

type SearchKind = 'everything' | 'films' | 'shows';

type SearchAreaProps = {
  search: string;
  onSearchChange: (search: string) => void;
  genre: string | null;
  onGenreChange: (genre: string | null) => void;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  onItemsLoaded?: (items: MediaSummary[]) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

export type { SearchAreaProps, SearchKind };
