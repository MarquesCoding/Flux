import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { ShowDetail } from '@FluxContracts/schemas/Show';

type PickedUp = {
  episode: MediaSummary;
  startSeconds: number;
  isResuming: boolean;
};

/**
 * The episode a viewer means when they press one button.
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
