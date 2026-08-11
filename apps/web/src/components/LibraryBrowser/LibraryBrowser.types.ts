import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';

type LibraryBrowserProps = {
  /**
   * What the shell's search box currently holds.
   *
   * Passed in rather than owned here: the box lives in the top bar, and two
   * boxes searching the same library would be one too many.
   */
  search?: string;
  /**
   * Whether to open with a featured item filling the screen.
   */
  hasHero?: boolean;
  onSearchChange?: (search: string) => void;
  /**
   * Told which item the hero is showing, so the page can be lit by it.
   */
  onFeatureChange?: (media: MediaSummary) => void;
  /**
   * Called with the colours the hero is showing, so the page can be lit by
   * what is actually on screen rather than by a colour chosen in advance.
   */
  onPalette?: (lights: MoodLight[]) => void;
  onPlay: (media: MediaSummary) => void;
  /**
   * Starts something, rather than opening the page about it.
   *
   * The hero's one button plays; a card opens the page. They are different
   * intentions and deserve different callbacks.
   */
  onWatch?: (media: MediaSummary, startSeconds: number) => void;
  /**
   * Called with whatever this browser is showing.
   *
   * The address bar names items by identifier, and something has to turn one
   * back into an item. The library already has them all, so it says so rather
   * than every other part of the application asking the server again.
   */
  onItemsLoaded?: (items: MediaSummary[]) => void;
  /**
   * Whether this viewer has kept each item, and how they say otherwise.
   */
  /**
   * Opens the page about the series an item belongs to, rather than about the
   * item. Given the episode, since that is what a shelf of episodes has.
   */
  onOpenShow?: (media: MediaSummary) => void;
  isKept?: (mediaId: string) => boolean;
  onToggleKept?: (media: MediaSummary) => void;
};

type BrowserState = 'loading' | 'ready' | 'unreachable';

type LoadedLibraries = {
  libraries: Library[];
  selectedId: string | null;
};

export type { BrowserState, LibraryBrowserProps, LoadedLibraries };
