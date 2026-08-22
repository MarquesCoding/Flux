import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { ShowDetail } from '@ValenceContracts/schemas/Show';

type PickedUp = {
  episode: MediaSummary;
  startSeconds: number;
  isResuming: boolean;
};

/**
 * Works out which episode a viewer means when they press the one play button on a programme: the one
 * they were part-way through, or the first they have not finished, or the very first if they have
 * never watched any of it. One button rather than a choice, because the answer is nearly always
 * obvious and being asked is worse than being wrong occasionally.
 *
 * @param show - The programme and its episodes.
 * @param progress - How to ask where a given episode was left and whether it was finished.
 * @returns The episode, where to start it and whether that counts as resuming, or null where the
 *   programme has no episodes at all.
 */
const pickUpFrom = (
  show: ShowDetail,
  {
    resumeFor,
    isFinished,
  }: {
    resumeFor?: ((mediaId: string) => number | null) | undefined;
    isFinished?: ((mediaId: string) => boolean) | undefined;
  } = {},
): PickedUp | null => {
  const episodes = show.seasons.flatMap((season) => season.episodes);

  if (episodes.length === 0) {
    return null;
  }

  const halfWatched = episodes.find((episode) => (resumeFor?.(episode.id) ?? null) !== null);

  if (halfWatched !== undefined) {
    return {
      episode: halfWatched,
      startSeconds: Math.floor(resumeFor?.(halfWatched.id) ?? 0),
      isResuming: true,
    };
  }

  const next = episodes.find((episode) => isFinished?.(episode.id) !== true) ?? episodes[0];

  return next === undefined ? null : { episode: next, startSeconds: 0, isResuming: false };
};

export { pickUpFrom };
