import type { ShowSummary } from '@FluxContracts/schemas/Show'

type ShowCardProps = {
  show: ShowSummary
  onSelect: (show: ShowSummary) => void
}

export type { ShowCardProps }
