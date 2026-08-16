import { groupIntoShows } from './groupIntoShows';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { PersonCredits } from '@FluxContracts/schemas/Person';

/**
 * Sorts what somebody is in on this server into the three things a viewer means by it: the films,
 * the programmes, and the individual episodes. An episode belongs in two of those at once — it is
 * both an episode they were in and evidence of a programme they were in — so the programmes are
 * derived from the episodes rather than being a separate list to keep in step.
 *
 * A programme appears once however many of its episodes they were in, which is the answer to "what
 * else of theirs is here": one entry for the thing somebody would go and watch.
 *
 * @param items - Everything on this server whose cast names them.
 * @returns The films, the programmes and the episodes, each in the order they should read.
 */
const splitPersonCredits = (items: MediaSummary[]): PersonCredits => {
  const episodes = items.filter(
    (item) => item.seriesTitle !== null && item.seriesTitle !== undefined,
  );

  const films = items.filter((item) => item.seriesTitle === null || item.seriesTitle === undefined);

  return {
    films,
    shows: groupIntoShows(episodes),
    episodes,
  };
};

export { splitPersonCredits };
