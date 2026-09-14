import type { MoodLight } from '@ValenceUI/MoodBackground.types';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type LibraryBrowserProps = {
  search?: string;
  hasHero?: boolean;
  name?: string;
  onSearchChange?: (search: string) => void;
  onFeatureChange?: (media: MediaSummary) => void;
  onPalette?: (lights: MoodLight[]) => void;
  onPlay: (media: MediaSummary) => void;
  onShow?: (seriesId: string) => void;
  onWatch?: (media: MediaSummary, startSeconds: number) => void;
  onItemsLoaded?: (items: MediaSummary[]) => void;
  onOpenShow?: (media: MediaSummary) => void;
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
  onAddLibrary?: () => void;
  onReading?: (isReading: boolean) => void;
};

type BrowserState = 'loading' | 'ready' | 'unreachable';

export type { BrowserState, LibraryBrowserProps };
