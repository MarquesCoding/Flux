import type { MediaSummary } from '@FluxContracts/schemas/Library'

type MediaDetailDialogProps = {
  media: MediaSummary | null
  onClose: () => void
  onPlay: (media: MediaSummary) => void
  /**
   * Other episodes of the same season, when this item is one.
   */
  siblings?: MediaSummary[]
  onSelectSibling?: (media: MediaSummary) => void
}

export type { MediaDetailDialogProps }
