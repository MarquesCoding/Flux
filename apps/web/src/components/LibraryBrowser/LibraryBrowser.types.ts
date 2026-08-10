import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'

type LibraryBrowserProps = {
  /**
   * What the shell's search box currently holds.
   *
   * Passed in rather than owned here: the box lives in the top bar, and two
   * boxes searching the same library would be one too many.
   */
  search?: string
  /**
   * Whether to open with a featured item filling the screen.
   */
  hasHero?: boolean
  /**
   * Told which item the hero is showing, so the page can be lit by it.
   */
  onFeatureChange?: (media: MediaSummary) => void
  onPlay: (media: MediaSummary) => void
}

type BrowserState = 'loading' | 'ready' | 'unreachable'

type LoadedLibraries = {
  libraries: Library[]
  selectedId: string | null
}

export type { BrowserState, LibraryBrowserProps, LoadedLibraries }
