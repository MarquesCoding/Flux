import { inBroadcastOrder } from '@ValenceCore/functions/inBroadcastOrder';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type Season = {
  seasonNumber: number | null;
  episodes: MediaSummary[];
};

/**
 * Gathers episodes into the seasons they belong to, in the order they were broadcast.
 *
 * A flat list of episodes reads as one long run the moment a programme has more than one season —
 * episode seven is followed by episode one and nothing says why. Grouping is what makes the second
 * one legible as a beginning rather than a mistake.
 *
 * @param items - The episodes, in whatever order they arrived.
 * @returns The seasons, each holding its own episodes in order.
 */
const intoSeasons = (items: readonly MediaSummary[]): Season[] => {
  const held = new Map<number | null, MediaSummary[]>();

  for (const episode of [...items].sort(inBroadcastOrder)) {
    const season = episode.seasonNumber ?? null;

    held.set(season, [...(held.get(season) ?? []), episode]);
  }

  return [...held.entries()].map(([seasonNumber, episodes]) => ({ seasonNumber, episodes }));
};

export type { Season };

export { intoSeasons };
