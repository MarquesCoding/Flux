import { useEffect, useRef } from 'react';
import { isTheDesktopClient, nowWatching } from '@FluxScreens/desktop/theDesktopShell';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const A_SECOND = 1000;

const REFRESHED_EVERY = 15;

type DiscordPresence = {
  media: Pick<MediaSummary, 'id' | 'title'> &
    Partial<Pick<MediaSummary, 'seriesTitle' | 'seasonNumber' | 'episodeNumber' | 'externalId'>> & {
      durationSeconds?: number;
    };
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
 * The position is kept out of the dependencies and only a coarse part of it is watched at all. Told
 * the end, Discord counts to it on its own, so saying it again every second buys nothing — and it
 * costs: React runs an effect's cleanup before it runs the effect again, so a dependency that moved
 * every second meant the status was cleared and re-set twice a second for the whole of a film. What
 * clears it now is stopping or leaving, which are the only two things that should.
 *
 * Every fifteen seconds it is said again anyway, which is what keeps a seek from leaving Discord
 * counting to a time that has stopped being true.
 *
 * @param presence - What is playing, whether it is, and whether this profile wants it published.
 */
const useDiscordPresence = ({
  media,
  isPlaying,
  positionSeconds,
  isAllowed,
}: DiscordPresence): void => {
  const { id, title, seriesTitle, seasonNumber, episodeNumber, externalId, durationSeconds } =
    media;
  const shouldSay = isAllowed && isPlaying && isTheDesktopClient();
  const left =
    typeof durationSeconds === 'number' && durationSeconds > 0
      ? Math.max(Math.round(durationSeconds - positionSeconds), 0)
      : null;
  const position = useRef(left);
  const refresh = left === null ? 0 : Math.round(left / REFRESHED_EVERY);

  useEffect(() => {
    position.current = left;
  });

  useEffect(
    () => () => {
      nowWatching(null);
    },
    [],
  );

  useEffect(() => {
    if (!shouldSay) {
      nowWatching(null);

      return;
    }

    const startedAt = Date.now();
    const remaining = position.current;

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
  }, [
    shouldSay,
    id,
    title,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    externalId,
    refresh,
    durationSeconds,
  ]);
};

export type { DiscordPresence };

export { useDiscordPresence };
