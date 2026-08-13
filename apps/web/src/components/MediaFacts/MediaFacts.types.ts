import type { MediaSummary } from '@FluxContracts/schemas/Library';

type MediaFactsProps = {
  media: MediaSummary;
  /**
   * How the line is set. The hero says this louder than a card does, and the
   * facts themselves are the same either way.
   */
  className?: string;
  /**
   * Whether to say how long it runs.
   *
   * A page about one item has room for it and somebody deciding what to watch
   * tonight wants it. A card in a row of twenty does not: the runtime is the
   * least distinguishing thing on it.
   */
  hasRuntime?: boolean;
  /**
   * Whether to say where this sits in its series.
   *
   * On everywhere something is being picked out of a list, where which episode
   * it is may be the whole reason for choosing it. Off where the subject is
   * the programme rather than tonight's instalment — a hero introduces a show,
   * and "EP4 · S1" under its name reads as though the show were the episode.
   */
  hasEpisode?: boolean;
};

export type { MediaFactsProps };
