import type { MediaSummary } from '@FluxContracts/schemas/Library'

/**
 * What kind of thing somebody is looking for.
 *
 * Films and programmes are told apart by whether a file belongs to a series,
 * which is the only difference a library can see: a folder of films and a
 * folder of episodes are the same shape on disk.
 */
type SearchKind = 'everything' | 'films' | 'shows'

type SearchAreaProps = {
  /**
   * What is in the box, kept in the address so a search can be sent to
   * somebody.
   */
  search: string
  onSearchChange: (search: string) => void
  onPlay: (media: MediaSummary, startSeconds: number) => void
  onInspect: (media: MediaSummary) => void
  /**
   * Called with whatever the search has shown, so an address naming one of
   * them can be turned back into an item.
   */
  onItemsLoaded?: (items: MediaSummary[]) => void
  watchedFractionFor?: (mediaId: string) => number | undefined
  resumeFor?: (mediaId: string) => number | null
  isKept?: (mediaId: string) => boolean
  onToggleKept?: (media: MediaSummary) => void
}

export type { SearchAreaProps, SearchKind }
