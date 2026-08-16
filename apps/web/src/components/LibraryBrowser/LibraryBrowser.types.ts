import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type LibraryBrowserProps = {
  search?: string;
  hasHero?: boolean;
  onSearchChange?: (search: string) => void;
  libraryId?: string | null;
  onLibraryChange?: (libraryId: string) => void;
  onFeatureChange?: (media: MediaSummary) => void;
  onPalette?: (lights: MoodLight[]) => void;
  onPlay: (media: MediaSummary) => void;
  onShow?: (seriesId: string) => void;
  onWatch?: (media: MediaSummary, startSeconds: number) => void;
  onItemsLoaded?: (items: MediaSummary[]) => void;
  onOpenShow?: (media: MediaSummary) => void;
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

type BrowserState = 'loading' | 'ready' | 'unreachable';

export type { BrowserState, LibraryBrowserProps };
