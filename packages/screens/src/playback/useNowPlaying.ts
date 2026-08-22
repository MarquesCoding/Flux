import { useEffect } from 'react';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import {
  artworkFetchedForTheSystem,
  artworkTheSystemAccepts,
} from '@ValenceScreens/playback/artworkTheSystemAccepts';

const A_SKIP = 10;

const POSTER_SIZES = ['256x384', '512x768'] as const;

type NowPlaying = {
  media: Pick<MediaSummary, 'id' | 'title'> &
    Partial<Pick<MediaSummary, 'seriesTitle' | 'seasonNumber' | 'episodeNumber' | 'hasPoster'>>;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
};

/**
 * The system's own media controls, where this engine has them.
 *
 * Asked for by value rather than by name, because the type says it is always there and it is not:
 * an older engine has none of this, and a name that exists holding nothing would pass a check for
 * the name and then throw on the first film somebody plays.
 *
 * @returns The controls, or nothing where the engine offers none.
 */
const theSystemsControls = (): MediaSession | null =>
  typeof navigator.mediaSession === 'object' && typeof MediaMetadata === 'function'
    ? navigator.mediaSession
    : null;

/**
 * Names the episode a programme belongs to, the way somebody would say it.
 *
 * @param media - What is playing.
 * @returns The line to put under the title, or nothing where there is nothing to say.
 */
const whichEpisode = (media: NowPlaying['media']): string => {
  const { seasonNumber, episodeNumber } = media;

  if (typeof seasonNumber !== 'number' || typeof episodeNumber !== 'number') {
    return '';
  }

  return `Series ${seasonNumber.toString()}, Episode ${episodeNumber.toString()}`;
};

/**
 * Tells the operating system what is playing, so its own controls say so.
 *
 * A browser engine works out on its own that a `video` element is playing and offers the system a
 * play button for it. What it cannot work out is what the film is called — which is why the system
 * shows the application's name and a blank square until somebody says otherwise.
 *
 * Everything here is the Media Session API, so it is as true of a browser as of the desktop client:
 * the same lock screen on a phone, the same Now Playing panel on a Mac, the same media keys.
 *
 * The buttons are wired to the player's own handlers rather than to the element, because pausing
 * during a watch party is a message to everybody watching rather than a change to this machine — and
 * a play button on a menu bar that quietly desynchronised four people would be worse than no button.
 *
 * @param nowPlaying - What is playing, where it is up to, and how to change that.
 */
const useNowPlaying = ({
  media,
  isPlaying,
  positionSeconds,
  durationSeconds,
  onTogglePlay,
  onSeek,
}: NowPlaying): void => {
  const { id, title, seriesTitle, hasPoster } = media;
  const episode = whichEpisode(media);
  const whole = Math.floor(positionSeconds);

  useEffect(() => {
    const session = theSystemsControls();

    if (session === null) {
      return;
    }

    const describe = (artwork: { src: string; sizes: string }[]): void => {
      session.metadata = new MediaMetadata({
        title,
        artist: typeof seriesTitle === 'string' && seriesTitle !== '' ? seriesTitle : 'Valence',
        album: episode,
        artwork,
      });
    };

    const poster = `/api/media/${id}/image/poster`;
    const straight = hasPoster === true ? artworkTheSystemAccepts(poster) : null;

    describe(straight === null ? [] : POSTER_SIZES.map((sizes) => ({ src: straight, sizes })));

    let held: string | null = null;
    let drawn = true;

    if (hasPoster === true && straight === null) {
      void artworkFetchedForTheSystem(poster).then((fetched) => {
        if (fetched === null) {
          return;
        }

        if (!drawn) {
          URL.revokeObjectURL(fetched);

          return;
        }

        held = fetched;

        describe(POSTER_SIZES.map((sizes) => ({ src: fetched, sizes })));
      });
    }

    return () => {
      drawn = false;
      session.metadata = null;

      if (held !== null) {
        URL.revokeObjectURL(held);
      }
    };
  }, [id, title, seriesTitle, episode, hasPoster]);

  useEffect(() => {
    const session = theSystemsControls();

    if (session === null) {
      return;
    }

    session.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    const session = theSystemsControls();

    if (session === null || durationSeconds <= 0) {
      return;
    }

    session.setPositionState({
      duration: durationSeconds,
      position: Math.min(Math.max(whole, 0), durationSeconds),
      playbackRate: 1,
    });
  }, [whole, durationSeconds]);

  useEffect(() => {
    const session = theSystemsControls();

    if (session === null) {
      return;
    }

    const goTo = (seconds: number) => {
      onSeek(Math.min(Math.max(seconds, 0), durationSeconds > 0 ? durationSeconds : seconds));
    };

    session.setActionHandler('play', onTogglePlay);
    session.setActionHandler('pause', onTogglePlay);
    session.setActionHandler('seekbackward', (details) => {
      goTo(positionSeconds - (details.seekOffset ?? A_SKIP));
    });
    session.setActionHandler('seekforward', (details) => {
      goTo(positionSeconds + (details.seekOffset ?? A_SKIP));
    });
    session.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        goTo(details.seekTime);
      }
    });

    return () => {
      for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as const) {
        session.setActionHandler(action, null);
      }
    };
  }, [onTogglePlay, onSeek, positionSeconds, durationSeconds]);
};

export type { NowPlaying };

export { useNowPlaying };
