import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SplashScreen } from '@FluxUI/SplashScreen';
import { VideoPlayer } from '@FluxScreens/components/VideoPlayer/VideoPlayer';
import { PartyMenu } from '@FluxScreens/components/PartyMenu/PartyMenu';
import { PartyPasswordDialog } from '@FluxScreens/components/PartyPasswordDialog/PartyPasswordDialog';
import { whereToBegin, WAIT_FOR_THE_ROOM_MS } from '@FluxClient/party/whereToBegin';
import { invitationTo } from '@FluxScreens/party/invitationTo';
import { countCarriedOn } from '@FluxClient/playback/countCarriedOn';
import { decideWhatFollows } from '@FluxClient/playback/decideWhatFollows';
import { findSiblings, nextEpisode } from '@FluxClient/library/pickFeatured';
import { watchedFraction, FINISHED_WITHIN_SECONDS } from '@FluxContracts/schemas/WatchProgress';
import { STILL_WATCHING_OFF } from '@FluxContracts/schemas/StillWatching';
import { usePlace } from '@FluxScreens/navigation/usePlace';
import { useShell } from '@FluxClient/shell/useShell';

const PROGRESS_EVERY_SECONDS = 5;

/**
 * The player, filling the screen, and the watch party that may be watching along with it.
 */
const WatchPage = () => {
  const {
    title,
    known,
    progress,
    reportProgress,
    readProgress,
    startOverride,
    watchParty,
    household,
    watcher,
    setAskingAbout,
  } = useShell();

  const { place, go } = usePlace();
  const prefersReducedMotion = useReducedMotion();

  const [hasWaitedForTheRoom, setHasWaitedForTheRoom] = useState(false);
  const begunRef = useRef<{ mediaId: string; atSeconds: number } | null>(null);
  const markedAtRef = useRef(0);
  const carriedOnRef = useRef(0);
  const carriedOnToRef = useRef<string | null>(null);
  const joinedRef = useRef<string | null>(null);

  const playing = place.playing === null ? null : (known.get(place.playing) ?? null);

  useEffect(() => {
    markedAtRef.current = 0;

    void readProgress();
  }, [place.playing, readProgress]);

  useEffect(() => {
    carriedOnRef.current = countCarriedOn({
      nowPlaying: place.playing,
      carriedOnTo: carriedOnToRef.current,
      carriedOn: carriedOnRef.current,
    });
  }, [place.playing]);

  useEffect(() => {
    if (place.party === null || joinedRef.current === place.party) {
      return;
    }

    joinedRef.current = place.party;
    watchParty.join(place.party);
  }, [place.party, watchParty]);

  useEffect(() => {
    if (place.party === null) {
      setHasWaitedForTheRoom(false);

      return;
    }

    const timer = setTimeout(() => {
      setHasWaitedForTheRoom(true);
    }, WAIT_FOR_THE_ROOM_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [place.party]);

  const partyPlayback = useMemo(
    () =>
      watchParty.party === null
        ? null
        : {
            command: watchParty.command,
            meConnectionId: watchParty.meConnectionId,
            referenceSeconds: watchParty.referenceSeconds,
            jitterMs: watchParty.jitterMs,
            isPlaying: watchParty.party.isPlaying,
            isHeld: watchParty.party.isHeld,
            waitingFor: watchParty.waitingFor,
            id: watchParty.party.id,
            members: watchParty.party.members.length,
            onReport: watchParty.report,
            onCommand: watchParty.send,
          },
    [
      watchParty.party,
      watchParty.command,
      watchParty.meConnectionId,
      watchParty.referenceSeconds,
      watchParty.jitterMs,
      watchParty.waitingFor,
      watchParty.report,
      watchParty.send,
    ],
  );

  if (playing === null) {
    return <SplashScreen name={title} label={`Loading ${title}`} />;
  }

  const found = progress.get(playing.id);

  const startAt =
    startOverride?.mediaId === playing.id
      ? startOverride.seconds
      : found === undefined || found.isFinished
        ? 0
        : Math.floor(found.positionSeconds);

  const begun = begunRef.current;

  const beginning =
    begun !== null && begun.mediaId === playing.id
      ? { kind: 'begin' as const, atSeconds: begun.atSeconds }
      : whereToBegin({
          invitedTo: place.party,
          joined: watchParty.party?.id ?? null,
          roomSeconds: watchParty.referenceSeconds,
          resumeSeconds: startAt,
          isBeingAsked: watchParty.passwordWanted !== null,
          hasWaitedLongEnough: hasWaitedForTheRoom,
        });

  if (beginning.kind === 'wait') {
    return <SplashScreen name={title} label="Joining the watch party" />;
  }

  begunRef.current = { mediaId: playing.id, atSeconds: beginning.atSeconds };

  return (
    <motion.main
      initial={{ opacity: 0, scale: prefersReducedMotion === true ? 1 : 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion === true ? 0.15 : 0.45, ease: [0.2, 0, 0, 1] }}
      className="flux-below-the-bar z-40 flex flex-col bg-black"
    >
      <VideoPlayer
        media={playing}
        startSeconds={beginning.atSeconds}
        partyNotice={watchParty.notice}
        isImmersive
        renderPartyMenu={({ isHidden, onOpenChange }) => (
          <PartyMenu
            party={watchParty.party}
            meConnectionId={watchParty.meConnectionId}
            waitingFor={watchParty.waitingFor}
            isHidden={isHidden}
            onOpenChange={onOpenChange}
            onOpen={() => {
              watchParty.open(playing.id);
            }}
            onSetRole={watchParty.setRole}
            onLoosen={watchParty.loosen}
            onRemove={watchParty.remove}
            onSetPassword={watchParty.setPassword}
            people={household}
            onAsk={watchParty.ask}
            onLeave={() => {
              watchParty.leave();
              go({ party: null });
            }}
            {...(watchParty.party === null
              ? {}
              : { invitation: invitationTo(watchParty.party.id, watchParty.party.mediaId) })}
            onCopyInvitation={async (invitation) => {
              await navigator.clipboard.writeText(invitation);
            }}
          />
        )}
        {...(partyPlayback === null ? {} : { party: partyPlayback })}
        episodes={
          playing.seriesTitle === null || playing.seriesTitle === undefined
            ? []
            : [playing, ...findSiblings([...known.values()], playing)].sort(
                (left, right) => (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0),
              )
        }
        onSelectEpisode={(episode) => {
          go({ playing: episode.id });
        }}
        watchedFractionFor={(mediaId) => {
          const held = progress.get(mediaId);

          return held === undefined ? undefined : watchedFraction(held);
        }}
        onProgress={(positionSeconds, durationSeconds) => {
          const whole = Math.floor(positionSeconds);

          if (Math.abs(whole - markedAtRef.current) < PROGRESS_EVERY_SECONDS) {
            return;
          }

          markedAtRef.current = whole;

          reportProgress({
            mediaId: playing.id,
            positionSeconds,
            durationSeconds,
            isFinished: positionSeconds >= durationSeconds - FINISHED_WITHIN_SECONDS,
            updatedAt: new Date().toISOString(),
          });
        }}
        onEnded={() => {
          const decided = decideWhatFollows({
            following: nextEpisode([...known.values()], playing),
            carriedOn: carriedOnRef.current,
            askAfter: watcher?.askStillWatchingAfter ?? STILL_WATCHING_OFF,
          });

          if (decided.kind === 'nothing') {
            go({ playing: null, inspecting: playing.id });

            return;
          }

          if (decided.kind === 'ask') {
            setAskingAbout(decided.episode);

            return;
          }

          carriedOnRef.current += 1;
          carriedOnToRef.current = decided.episode.id;
          go({ playing: decided.episode.id, inspecting: null });
        }}
        onClose={() => {
          if (watchParty.party !== null) {
            watchParty.leave();
          }

          go({ playing: null, party: null, inspecting: playing.id });
          void readProgress();
        }}
      />

      <PartyPasswordDialog
        isOpen={watchParty.passwordWanted !== null}
        wasWrong={watchParty.passwordWanted?.wasWrong ?? false}
        onJoin={(password) => {
          watchParty.join(watchParty.passwordWanted?.partyId ?? '', password);
        }}
        onClose={() => {
          watchParty.stopAsking();
          go({ party: null });
        }}
      />
    </motion.main>
  );
};

WatchPage.displayName = 'WatchPage';

export { WatchPage };
