import type { MediaSummary } from '@FluxContracts/schemas/Library'

type MediaFactsProps = {
  media: MediaSummary
  /**
   * How the line is set. The hero says this louder than a card does, and the
   * facts themselves are the same either way.
   */
  className?: string
  /**
   * Whether to say how long it runs.
   *
   * A page about one item has room for it and somebody deciding what to watch
   * tonight wants it. A card in a row of twenty does not: the runtime is the
   * least distinguishing thing on it.
   */
  hasRuntime?: boolean
}

export type { MediaFactsProps }
