import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail } from '@FluxContracts/schemas/Show';

type PickedUp = {
  episode: MediaSummary;
  /**
   * Where to start it, and whether that is a continuation or a beginning.
   */
  startSeconds: number;
  isResuming: boolean;
};

/**
 * The episode a viewer means when they press one button.
 *
 * Somebody halfway through a series means the episode they stopped in the
 * middle of; somebody who finished that one means the next; somebody who has
 * never seen it means the first. All three are the same press, and asking them
 * to find their place in a list of ninety is asking them to do the library's
 * job.
 *
 * Anything part-watched wins over anything unwatched, because leaving a film
 * half-finished is a stronger signal than never having started one — and where
 * several are part-watched, the earliest in broadcast order is the one being
 * worked through.
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
