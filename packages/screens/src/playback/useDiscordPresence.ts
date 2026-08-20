import { useEffect, useRef } from 'react';
import { isTheDesktopClient, nowWatching } from '@FluxScreens/desktop/theDesktopShell';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const A_SECOND = 1000;

const REFRESHED_EVERY = 15;

type DiscordPresence = {
  media: Pick<MediaSummary, 'id' | 'title'> &
    Partial<
      Pick<
        MediaSummary,
        'seriesTitle' | 'seasonNumber' | 'episodeNumber' | 'externalId' | 'posterUrl'
      >
    > & {
      durationSeconds?: number;
    };
  isPlaying: boolean;
  positionSeconds: number;
  isAllowed: boolean;
  party?: { id: string; size: number } | null;
};

/**
 * Says what somebody is watching, for the window to publish to Discord.
 *
 * Only where the profile asked for it, and only in the desktop client — Discord's status is a socket
 * on the same machine, which no page can open, so a browser has nothing to say this to and says
 * nothing.
 *
 * A pause is still watching. Somebody who stopped for a moment has not gone back to the library, and
 * a status that said they had would be wrong about them for as long as they were away — so what is
 * open stays on the status and is marked as paused, and only leaving the player takes it off.
 *
 * What is sent is when it started and when it will end, rather than how far through it is. Discord
 * counts for itself from those, so a status stays right without being told again — and a status that
 * had to be pushed every second would be one that freezes whenever the machine is busy.
 *
 * Nothing is left behind: somebody who leaves the player stops being shown as watching it, which is
 * the whole reason a person turns this on rather than having it on.
 *
 * What is sent is when this would have started had it been played straight through, and when it
 * would end. Discord draws the bar between those two, so it reads as a position in the episode
 * rather than as time spent looking at it: told the start instead, somebody twenty minutes into an
 * episode showed three seconds elapsed of the three minutes they had left.
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
  party = null,
}: DiscordPresence): void => {
  const {
    id,
    title,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    externalId,
    posterUrl,
    durationSeconds,
  } = media;
  const shouldSay = isAllowed && isTheDesktopClient();
  const position = useRef(positionSeconds);
  const refresh = Math.round(positionSeconds / REFRESHED_EVERY);

  useEffect(() => {
    position.current = positionSeconds;
  });

  useEffect(
    () => () => {
      nowWatching(isAllowed && isTheDesktopClient() ? { kind: 'browsing' } : null);
    },
    [isAllowed],
  );

  useEffect(() => {
    if (!shouldSay) {
      nowWatching(isAllowed && isTheDesktopClient() ? { kind: 'browsing' } : null);

      return;
    }

    const at = Math.max(Math.round(position.current), 0);
    const startedAt = Date.now() - at * A_SECOND;
    const runs =
      typeof durationSeconds === 'number' && durationSeconds > 0
        ? Math.round(durationSeconds)
        : null;

    nowWatching({
      kind: 'watching',
      title,
      series: typeof seriesTitle === 'string' && seriesTitle !== '' ? seriesTitle : null,
      season: typeof seasonNumber === 'number' ? seasonNumber : null,
      episode: typeof episodeNumber === 'number' ? episodeNumber : null,
      startedAt,
      endsAt: runs === null ? null : startedAt + runs * A_SECOND,
      tmdbId: typeof externalId === 'string' && externalId !== '' ? externalId : null,
      isSeries: typeof seriesTitle === 'string' && seriesTitle !== '',
      isPaused: !isPlaying,
      artwork: typeof posterUrl === 'string' && posterUrl !== '' ? posterUrl : null,
      party,
    });
  }, [
    shouldSay,
    isPlaying,
    id,
    title,
    seriesTitle,
    seasonNumber,
    episodeNumber,
    externalId,
    posterUrl,
    party,
    refresh,
    durationSeconds,
    isAllowed,
  ]);
};

export type { DiscordPresence };

export { useDiscordPresence };
