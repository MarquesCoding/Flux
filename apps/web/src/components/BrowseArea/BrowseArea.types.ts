import type { MediaSummary } from '@FluxContracts/schemas/Library';

type BrowseKind = 'shows' | 'films' | 'new' | 'favourites';

type BrowseAreaProps = {
  kind: BrowseKind;
  onPlay: (media: MediaSummary, startSeconds: number) => void;
  onInspect: (media: MediaSummary) => void;
  onItemsLoaded?: (items: MediaSummary[]) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
  resumeFor?: (mediaId: string) => number | null;
  favourites?: string[];
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

export type { BrowseAreaProps, BrowseKind };
