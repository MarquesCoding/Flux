import { useEffect } from 'react';
import { isTheDesktopClient, nowWatching } from '@FluxScreens/desktop/theDesktopShell';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const A_SECOND = 1000;

type DiscordPresence = {
  media: Pick<MediaSummary, 'id' | 'title'> &
    Partial<
      Pick<MediaSummary, 'seriesTitle' | 'seasonNumber' | 'episodeNumber' | 'externalId'>
    > & { durationSeconds?: number };
  isPlaying: boolean;
  positionSeconds: number;
  isAllowed: boolean;
};

/**
 * Says what somebody is watching, for the window to publish to Discord.
 *
 * Only where the profile asked for it, and only in the desktop client — Discord's status is a socket
 * on the same machine, which no page can open, so a browser has nothing to say this to and says
 * nothing.
 *
 * What is sent is when it started and when it will end, rather than how far through it is. Discord
 * counts for itself from those, so a status stays right without being told again — and a status that
 * had to be pushed every second would be one that freezes whenever the machine is busy.
 *
 * Nothing is said while paused, and nothing is left behind: somebody who stops watching stops being
 * shown as watching, which is the whole reason a person turns this on rather than having it on.
 *
 * What is left out of the dependencies is the position, and only a whole second of it is watched at
 * all — the end is what Discord is told, and a status republished every frame would be one that
 * flickers rather than one that counts.
 *
 * @param presence - What is playing, whether it is, and whether this profile wants it published.
 */
const useDiscordPresence = ({
  media,
  isPlaying,
  positionSeconds,
  isAllowed,
}: DiscordPresence): void => {
  const { id, title, seriesTitle, seasonNumber, episodeNumber, externalId, durationSeconds } = media;
  const shouldSay = isAllowed && isPlaying && isTheDesktopClient();
  const remaining =
    typeof durationSeconds === 'number' && durationSeconds > 0
      ? Math.max(Math.round(durationSeconds - positionSeconds), 0)
      : null;

  useEffect(() => {
    if (!shouldSay) {
      nowWatching(null);

      return;
    }

    const startedAt = Date.now();

    nowWatching({
      title,
      series: typeof seriesTitle === 'string' && seriesTitle !== '' ? seriesTitle : null,
      season: typeof seasonNumber === 'number' ? seasonNumber : null,
      episode: typeof episodeNumber === 'number' ? episodeNumber : null,
      startedAt,
      endsAt: remaining === null ? null : startedAt + remaining * A_SECOND,
      tmdbId: typeof externalId === 'string' && externalId !== '' ? externalId : null,
      isSeries: typeof seriesTitle === 'string' && seriesTitle !== '',
    });

    return () => {
      nowWatching(null);
    };
  }, [
    shouldSay,
    id,
    title,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    externalId,
    remaining,
    durationSeconds,
  ]);
};

export type { DiscordPresence };

export { useDiscordPresence };
