import type { MediaSummary } from '@FluxContracts/schemas/Library';

type VideoPlayerProps = {
  media: Pick<MediaSummary, 'id' | 'title' | 'durationSeconds'>;
  /**
   * Whether the player owns the whole screen.
   *
   * An immersive player fills what it is given and lets the video decide its
   * own height, rather than sitting in a page's flow beneath a heading.
   */
  isImmersive?: boolean;
  /**
   * Where to begin, in seconds.
   *
   * Somebody resuming a film has already watched the first hour of it, and a
   * player that starts at zero regardless is a player that loses their place
   * every time they close it.
   */
  startSeconds?: number;
  onClose: () => void;
  /**
   * Says where this viewer has got to, as they get there.
   *
   * The server is told on a timer, but a page showing a progress bar cannot
   * wait for a round trip to be right: closing a film and finding the card
   * behind it still showing where you were an hour ago reads as nothing
   * having been saved at all.
   */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  /**
   * Called when the film runs out.
   *
   * What happens next belongs to whoever knows what else there is — an
   * episode is followed by the next episode, and a film is followed by
   * nothing.
   */
  onEnded?: () => void;
  /**
   * The season this belongs to, in order.
   *
   * Empty for a film, which is what keeps the episode list off one.
   */
  episodes?: MediaSummary[];
  onSelectEpisode?: (episode: MediaSummary) => void;
  watchedFractionFor?: (mediaId: string) => number | undefined;
};

type PlayerState = 'starting' | 'playing' | 'failed';

export type { PlayerState, VideoPlayerProps };
