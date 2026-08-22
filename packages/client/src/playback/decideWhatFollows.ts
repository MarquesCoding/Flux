import { shouldAskStillWatching } from '@ValenceContracts/schemas/StillWatching';

type Following<Episode> =
  { kind: 'nothing' } | { kind: 'ask'; episode: Episode } | { kind: 'play'; episode: Episode };

type WhatFollows<Episode> = {
  following: Episode | null;
  carriedOn: number;
  askAfter: number;
};

/**
 * What to do when an episode finishes: play the next one, ask first, or let it end.
 *
 * Kept apart from the player so the rule can be read and tested on its own. The order matters and is
 * easy to get wrong in passing: the question is asked *instead of* starting the next episode, never
 * over the top of one already playing. That is what makes it worth having — nothing is transcoded
 * for an empty room, and nothing is written to continue-watching for an episode nobody saw.
 *
 * @param following - The episode that would play next, or null where the series has run out.
 * @param carriedOn - How many episodes have followed on their own since somebody chose one.
 * @param askAfter - How many the profile allows before asking, or zero to never ask.
 * @returns What should happen.
 */
const decideWhatFollows = <Episode>({
  following,
  carriedOn,
  askAfter,
}: WhatFollows<Episode>): Following<Episode> => {
  if (following === null) {
    return { kind: 'nothing' };
  }

  return shouldAskStillWatching(carriedOn, askAfter)
    ? { kind: 'ask', episode: following }
    : { kind: 'play', episode: following };
};

export type { Following, WhatFollows };

export { decideWhatFollows };
