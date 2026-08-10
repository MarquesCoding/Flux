import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'

type LibraryBrowserProps = {
  /**
   * What the shell's search box currently holds.
   *
   * Passed in rather than owned here: the box lives in the top bar, and two
   * boxes searching the same library would be one too many.
   */
  search?: string
  onPlay: (media: MediaSummary) => void
}

type BrowserState = 'loading' | 'ready' | 'unreachable'

type LoadedLibraries = {
  libraries: Library[]
  selectedId: string | null
}

export type { BrowserState, LibraryBrowserProps, LoadedLibraries }
