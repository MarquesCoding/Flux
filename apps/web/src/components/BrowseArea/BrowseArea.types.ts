import type { MediaSummary } from '@FluxContracts/schemas/Library'

/**
 * What a browse page is a page of.
 *
 * Not a filter each: three of these are questions about the library and the
 * fourth is a question about the viewer, and the page reads the same either
 * way.
 */
type BrowseKind = 'shows' | 'films' | 'new' | 'favourites'

type BrowseAreaProps = {
  kind: BrowseKind
  onPlay: (media: MediaSummary, startSeconds: number) => void
  onInspect: (media: MediaSummary) => void
  onItemsLoaded?: (items: MediaSummary[]) => void
  watchedFractionFor?: (mediaId: string) => number | undefined
  resumeFor?: (mediaId: string) => number | null
  /**
   * What this viewer has kept, for the page that is a list of exactly that.
   */
  favourites?: string[]
  isKept?: (mediaId: string) => boolean
  onToggleKept?: (media: MediaSummary) => void
}

export type { BrowseAreaProps, BrowseKind }
