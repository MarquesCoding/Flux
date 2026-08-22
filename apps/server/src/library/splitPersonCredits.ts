import { inBroadcastOrder } from '@ValenceCore/functions/inBroadcastOrder';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { PersonCredits } from '@ValenceContracts/schemas/Person';

/**
 * Sorts what somebody is in on this server into the three things a viewer means by it: the films,
 * the programmes, and the individual episodes. An episode belongs in two of those at once — it is
 * both an episode they were in and evidence of a programme they were in — so the programmes are
 * derived from the episodes rather than being a separate list to keep in step.
 *
 * A programme appears once however many of its episodes they were in, which is the answer to "what
 * else of theirs is here": one entry for the thing somebody would go and watch. It is represented by
 * its earliest episode rather than by a programme of its own, so that a card on a person's page is
 * the same card as anywhere else and opens the programme the same way.
 *
 * @param items - Everything on this server whose cast names them.
 * @returns The films, the programmes and the episodes, each in the order they should read.
 */
const splitPersonCredits = (items: MediaSummary[]): PersonCredits => {
  const episodes = items.filter(
    (item) => item.seriesTitle !== null && item.seriesTitle !== undefined,
  );

  const films = items.filter((item) => item.seriesTitle === null || item.seriesTitle === undefined);

  const byProgramme = new Map<string, MediaSummary[]>();

  for (const episode of episodes) {
    const key = episode.seriesId ?? episode.seriesTitle ?? '';

    byProgramme.set(key, [...(byProgramme.get(key) ?? []), episode]);
  }

  const shows = [...byProgramme.values()].flatMap((held) => {
    const [first] = [...held].sort(inBroadcastOrder);

    return first === undefined ? [] : [first];
  });

  return { films, shows, episodes };
};

export { splitPersonCredits };
