const WATCHING = 3;

const LOGO = 'logo';

const A_SECOND = 1000;

type WhatIsPlaying = {
  title: string;
  series: string | null;
  season: number | null;
  episode: number | null;
  startedAt: number;
  endsAt: number | null;
  tmdbId: string | null;
  isSeries: boolean;
};

type DiscordActivity = {
  type: number;
  details: string;
  state?: string;
  timestamps: { start: number; end?: number };
  assets: { large_image: string; large_text: string; small_image?: string };
  buttons?: { label: string; url: string }[];
};

/**
 * Names the platform badge, which is the second asset registered against the application.
 *
 * Lower case because Discord holds asset names that way whatever they were uploaded as. Asked for
 * anything else it neither draws the badge nor says why: the activity is accepted, and the asset is
 * dropped out of it on the way through.
 *
 * @param platform - What this process is running on.
 * @returns The asset to draw small, or nothing where none is registered for it.
 */
const theBadgeFor = (platform: string): string | undefined =>
  platform === 'darwin' ? 'macos' : undefined;

/**
 * Writes what somebody is watching the way Discord shows it.
 *
 * The programme goes on the top line and the episode below it, because that is the order Discord
 * draws them in and the order somebody would say them. A film has only the top line.
 *
 * The times are sent rather than a progress figure, so Discord's own clock counts down without Flux
 * telling it anything again — a presence that had to be pushed every second would be a presence that
 * stutters whenever the machine is busy.
 *
 * The poster is not sent. Discord draws artwork only from images registered against the application
 * in advance, and a self-hosted library's posters are neither registered nor reachable from the
 * internet — sending a URL to one would either fail or publish somebody's server address. The Flux
 * logo is what is left, and it is the honest answer rather than a compromise.
 *
 * @param playing - What is playing, or nothing where nothing is.
 * @param platform - What this process is running on.
 * @returns The activity to send, or nothing to clear it.
 */
const aDiscordActivity = (
  playing: WhatIsPlaying | null,
  platform: string,
): DiscordActivity | null => {
  if (playing === null) {
    return null;
  }

  const badge = theBadgeFor(platform);

  const episode =
    typeof playing.season === 'number' && typeof playing.episode === 'number'
      ? `Series ${playing.season.toString()}, Episode ${playing.episode.toString()}`
      : null;

  const tmdb =
    playing.tmdbId === null
      ? null
      : {
          label: 'View on TMDB',
          url: `https://www.themoviedb.org/${playing.isSeries ? 'tv' : 'movie'}/${playing.tmdbId}`,
        };

  return {
    type: WATCHING,
    details: playing.series ?? playing.title,
    ...(playing.series === null ? {} : { state: episode ?? playing.title }),
    timestamps: {
      start: Math.floor(playing.startedAt / A_SECOND),
      ...(playing.endsAt === null ? {} : { end: Math.floor(playing.endsAt / A_SECOND) }),
    },
    assets: {
      large_image: LOGO,
      large_text: 'Flux',
      ...(badge === undefined ? {} : { small_image: badge }),
    },
    ...(tmdb === null ? {} : { buttons: [tmdb] }),
  };
};

export type { DiscordActivity, WhatIsPlaying };

export { aDiscordActivity };
