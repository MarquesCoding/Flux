import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { ShowSummary } from '@FluxContracts/schemas/Show';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { groupVariants } from '@FluxUI/animations/reveal';
import { SetupWizard } from '@FluxWeb/components/SetupWizard/SetupWizard';
import { LibraryBrowser } from '@FluxWeb/components/LibraryBrowser/LibraryBrowser';
import { SearchArea } from '@FluxWeb/components/SearchArea/SearchArea';
import { BrowseArea } from '@FluxWeb/components/BrowseArea/BrowseArea';
import { ShowDialog } from '@FluxWeb/components/ShowDialog/ShowDialog';
import { fetchShows } from '@FluxWeb/library/fetchShows';
import { fetchLibraries, fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
import { showSlug } from '@FluxCore/functions/showSlug';
import { useFavourites } from '@FluxWeb/library/useFavourites';
import { useRatings } from '@FluxWeb/library/useRatings';
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace';
import { readCurrentProfile } from '@FluxWeb/profiles/currentProfile';
import { pickAnything } from '@FluxWeb/library/pickAnything';
import { NotificationBell } from '@FluxWeb/components/NotificationBell/NotificationBell';
import { markNotificationsRead } from '@FluxWeb/notifications/fetchNotifications';
import type { Inbox } from '@FluxWeb/notifications/fetchNotifications';
import {
  canReceivePush,
  subscribeToPush,
  unsubscribeFromPush,
} from '@FluxWeb/notifications/subscribeToPush';
import { VideoPlayer } from '@FluxWeb/components/VideoPlayer/VideoPlayer';
import { MediaDetailDialog } from '@FluxWeb/components/MediaDetailDialog/MediaDetailDialog';
import { PersonDialog } from '@FluxWeb/components/PersonDialog/PersonDialog';
import { ShareArea } from '@FluxWeb/components/ShareArea/ShareArea';
import { ShareDialog } from '@FluxWeb/components/ShareDialog/ShareDialog';
import { StillWatchingDialog } from '@FluxWeb/components/StillWatchingDialog/StillWatchingDialog';
import { PartyMenu } from '@FluxWeb/components/PartyMenu/PartyMenu';
import { PartyPasswordDialog } from '@FluxWeb/components/PartyPasswordDialog/PartyPasswordDialog';
import { whereToBegin, WAIT_FOR_THE_ROOM_MS } from '@FluxWeb/party/whereToBegin';
import { invitationTo } from '@FluxWeb/party/invitationTo';
import { useWatchParty } from '@FluxWeb/party/useWatchParty';
import { countCarriedOn } from '@FluxWeb/playback/countCarriedOn';
import { decideWhatFollows } from '@FluxWeb/playback/decideWhatFollows';
import {
  STILL_WATCHING_ANSWER_SECONDS,
  STILL_WATCHING_OFF,
} from '@FluxContracts/schemas/StillWatching';
import { AppShell } from '@FluxWeb/components/AppShell/AppShell';
import { SplashScreen } from '@FluxUI/SplashScreen';
import { AdminArea } from '@FluxWeb/components/AdminArea/AdminArea';
import { AccountArea } from '@FluxWeb/components/AccountArea/AccountArea';
import { ProfileGate } from '@FluxWeb/components/ProfileGate/ProfileGate';
import { usePlace } from '@FluxWeb/navigation/usePlace';
import { findSiblings, nextEpisode } from '@FluxWeb/library/pickFeatured';
import { byMediaId } from '@FluxWeb/playback/watchProgress';
import { viewingQueries } from '@FluxWeb/query/viewingQueries';
import { summariseDetail } from '@FluxWeb/library/summariseDetail';
import { watchPresence } from '@FluxWeb/presence/watchPresence';
import { watchedFraction, FINISHED_WITHIN_SECONDS } from '@FluxContracts/schemas/WatchProgress';
import { resumeFor } from '@FluxWeb/playback/resumeFor';
import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types';
import { signOut } from '@FluxWeb/session/signOut';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionQueries } from '@FluxWeb/query/sessionQueries';
import { notificationQueries } from '@FluxWeb/query/notificationQueries';
import { libraryQueries } from '@FluxWeb/query/libraryQueries';
import { useFreshFromTheSocket } from '@FluxWeb/query/useFreshFromTheSocket';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';
import type { AppProps } from './App.types';

const NOTHING_WAITING: Inbox = { notifications: [], unread: 0 };

const PROGRESS_EVERY_SECONDS = 5;

const PARTY_NOTICE_LINGERS_MS = 6000;

/**
 * The application itself: what is on screen, who is signed in, and what is playing. Setup, sign-in
 * and the library are decided from what the server reports rather than from anything held here, so a
 * second browser cannot skip setup and a stale tab cannot behave as though it is still signed in.
 *
 * @param initialTitle - What the platform is called, which an operator may have changed.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const cache = useQueryClient();

  useFreshFromTheSocket();

  const server = useQuery(sessionQueries.setup());
  const status = server.data ?? null;

  const isSetUp = status?.isComplete === true;

  const session = useQuery({ ...sessionQueries.who(), enabled: isSetUp });
  const user = isSetUp ? (session.data ?? null) : null;
  const [reported, setReported] = useState(new Map<string, WatchProgress>());
  const markedAtRef = useRef(0);
  const [startOverride, setStartOverride] = useState<{ mediaId: string; seconds: number } | null>(
    null,
  );
  const [, setFeatured] = useState<MediaSummary | null>(null);
  const [moodLights, setMoodLights] = useState<MoodLight[]>([]);
  const favourites = useFavourites(user?.id ?? null);
  const ratings = useRatings(user?.id ?? null);
  const [openShow, setOpenShow] = useState<ShowSummary | null>(null);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [sharing, setSharing] = useState<MediaSummary | null>(null);
  const [guestPlaying, setGuestPlaying] = useState<MediaSummary | null>(null);
  const [guestReached, setGuestReached] = useState<Map<string, number>>(new Map());
  const [askingAbout, setAskingAbout] = useState<MediaSummary | null>(null);

  const watchParty = useWatchParty();

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

  const joinedRef = useRef<string | null>(null);
  const begunRef = useRef<{ mediaId: string; atSeconds: number } | null>(null);
  const [hasWaitedForTheRoom, setHasWaitedForTheRoom] = useState(false);

  const carriedOnRef = useRef(0);
  const carriedOnToRef = useRef<string | null>(null);

  const everyone = useQuery({
    ...sessionQueries.everyone(),
    enabled: watchParty.party !== null,
  });

  const household = useMemo(
    () => (everyone.data ?? []).map((person) => ({ id: person.id, name: person.name })),
    [everyone.data],
  );

  const people = useQuery({ ...sessionQueries.profiles(), enabled: user !== null });

  const watching = readCurrentProfile();

  const watcher =
    watching === null
      ? null
      : ((people.data ?? []).find((person) => person.id === watching) ?? null);
  const [known, setKnown] = useState(new Map<string, MediaSummary>());
  const { place, go, replace } = usePlace();

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

  useEffect(() => {
    if (watchParty.party !== null && place.party !== watchParty.party.id) {
      replace({ playing: watchParty.party.mediaId, party: watchParty.party.id });
    }
  }, [watchParty.party, place.party, replace]);

  useEffect(() => {
    if (watchParty.notice === null) {
      return;
    }

    if (place.party !== null) {
      replace({ party: null });
    }

    const goes = setTimeout(() => {
      watchParty.forgetNotice();
    }, PARTY_NOTICE_LINGERS_MS);

    return () => {
      clearTimeout(goes);
    };
  }, [watchParty.notice, watchParty.forgetNotice, place.party, replace]);

  useEffect(() => {
    carriedOnRef.current = countCarriedOn({
      nowPlaying: place.playing,
      carriedOnTo: carriedOnToRef.current,
      carriedOn: carriedOnRef.current,
    });
  }, [place.playing]);

  const prefersReducedMotion = useReducedMotion();

  const held = useQuery(notificationQueries.inbox());
  const inbox = held.data ?? NOTHING_WAITING;

  const howToPush = useQuery(notificationQueries.settings());
  const pushKey = howToPush.data?.pushPublicKey ?? '';

  const [pushChoice, setPushChoice] = useState<boolean | null>(null);

  const isPushOn = pushChoice ?? howToPush.data?.preferences.some((one) => one.push) ?? false;

  const libraries = useQuery(libraryQueries.all());

  const surpriseKinds = useMemo(
    () => [...new Set((libraries.data ?? []).map((one) => one.kind))],
    [libraries.data],
  );

  useEffect(() => {
    if (place.show === null) {
      setOpenShow(null);

      return;
    }

    if (openShow?.id === place.show) {
      return;
    }

    let abandoned = false;

    void fetchLibraries()
      .then(async (libraries) => {
        for (const entry of libraries) {
          const shows = await fetchShows(entry.id);
          const found = shows.find((one) => one.id === place.show);

          if (found !== undefined) {
            return found;
          }
        }

        return null;
      })
      .then((found) => {
        if (!abandoned) {
          setOpenShow(found);
        }
      });

    return () => {
      abandoned = true;
    };
  }, [place.show, openShow]);

  const section: ShellSection = place.section;
  const inspecting = place.inspecting === null ? null : (known.get(place.inspecting) ?? null);
  const playing = place.playing === null ? null : (known.get(place.playing) ?? null);

  /**
   * Reads where something actually got to, for picking it up again — a different question from whether
   * to offer a resume. Whether to offer is a judgement about whether somebody meant to start
   * something; where to start once they are already watching is a fact, and a page reloading forty
   * seconds in should carry on at forty seconds rather than be told that does not count as started.
   *
   * @param mediaId - The item being opened.
   * @returns Where to start it, or the beginning where it was finished or never begun.
   */
  const positionFor = (mediaId: string): number => {
    const found = progress.get(mediaId);

    return found === undefined || found.isFinished ? 0 : Math.floor(found.positionSeconds);
  };

  const rememberItems = useCallback((items: MediaSummary[]) => {
    setKnown((current) => {
      const next = new Map(current);

      for (const item of items) {
        next.set(item.id, item);
      }

      return next;
    });
  }, []);

  const watched = useQuery(viewingQueries.progress());
  const hasReadProgress = !watched.isPending;

  const progress = useMemo(() => {
    const held = byMediaId(watched.data ?? []);

    for (const [mediaId, mine] of reported) {
      const theirs = held.get(mediaId);

      if (theirs === undefined || Math.abs(theirs.positionSeconds - mine.positionSeconds) > 1) {
        held.set(mediaId, mine);
      }
    }

    return held;
  }, [watched.data, reported]);

  useEffect(() => {
    const held = byMediaId(watched.data ?? []);

    setReported((current) => {
      const next = new Map(current);

      for (const [mediaId, mine] of current) {
        const theirs = held.get(mediaId);

        if (theirs !== undefined && Math.abs(theirs.positionSeconds - mine.positionSeconds) <= 1) {
          next.delete(mediaId);
        }
      }

      return next.size === current.size ? current : next;
    });
  }, [watched.data]);

  const readProgress = useCallback(
    async () => cache.invalidateQueries({ queryKey: viewingQueries.progress().queryKey }),
    [cache],
  );

  useEffect(() => {
    const wanted = [place.playing, place.inspecting]
      .filter((id) => id !== null)
      .filter((id) => !known.has(id));

    if (wanted.length === 0) {
      return;
    }

    let abandoned = false;

    void Promise.all(wanted.map(async (id) => ({ id, detail: await fetchMediaDetail(id) }))).then(
      (answers) => {
        if (abandoned) {
          return;
        }

        const summaries = answers
          .map((answer) => answer.detail)
          .filter((detail) => detail !== null)
          .map(summariseDetail);

        if (summaries.length > 0) {
          rememberItems(summaries);
        }

        const missing = answers
          .filter((answer) => answer.detail === null)
          .map((answer) => answer.id);

        if (missing.includes(place.playing ?? '')) {
          replace({ playing: null });
        }

        if (missing.includes(place.inspecting ?? '')) {
          replace({ inspecting: null });
        }
      },
    );

    return () => {
      abandoned = true;
    };
  }, [place.playing, place.inspecting, known, rememberItems, replace]);

  useEffect(() => {
    markedAtRef.current = 0;

    if (place.playing === null) {
      setStartOverride(null);

      return;
    }

    void readProgress();
  }, [place.playing, readProgress]);

  const refresh = useCallback(async () => {
    await cache.invalidateQueries({ queryKey: sessionQueries.key });
  }, [cache]);

  useEffect(() => {
    if (user !== null) {
      void readProgress();
    }
  }, [user, readProgress]);

  useEffect(() => {
    if (user === null) {
      return;
    }

    return watchPresence();
  }, [user]);

  if (server.isPending || (isSetUp && session.isPending)) {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />;
  }

  if (server.isError || session.isError || status === null) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-2 p-8">
        <h1 className="text-2xl font-semibold text-text">Flux is not reachable</h1>
        <p className="text-text-muted">
          The server did not respond. Check that it is running and reload the page.
        </p>
      </main>
    );
  }

  if (!status.isComplete) {
    return (
      <SetupWizard
        status={status}
        onComplete={() => {
          void refresh();
        }}
      />
    );
  }

  if (place.shareToken !== null) {
    if (guestPlaying !== null) {
      return (
        <main className="fixed inset-0 z-40 flex flex-col bg-black">
          <VideoPlayer
            media={guestPlaying}
            startSeconds={guestReached.get(guestPlaying.id) ?? 0}
            isImmersive
            onProgress={(positionSeconds) => {
              setGuestReached((held) => new Map(held).set(guestPlaying.id, positionSeconds));
            }}
            onClose={() => {
              setGuestPlaying(null);
            }}
          />
        </main>
      );
    }

    return (
      <ShareArea
        token={place.shareToken}
        name={initialTitle}
        resumeFor={(mediaId) => guestReached.get(mediaId) ?? 0}
        onPlay={(media) => {
          setGuestPlaying(media);
        }}
      />
    );
  }

  if (user === null) {
    return (
      <ProfileGate
        name={initialTitle}
        onSignedIn={() => {
          go({ section: 'home', search: '', inspecting: null, playing: null });
          void refresh();
        }}
      />
    );
  }

  if (place.playing !== null && (playing === null || !hasReadProgress)) {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />;
  }

  const startAt =
    playing === null
      ? 0
      : startOverride?.mediaId === playing.id
        ? startOverride.seconds
        : positionFor(playing.id);

  const beginning =
    begunRef.current?.mediaId === playing?.id && begunRef.current !== null
      ? { kind: 'begin' as const, atSeconds: begunRef.current.atSeconds }
      : whereToBegin({
          invitedTo: place.party,
          joined: watchParty.party?.id ?? null,
          roomSeconds: watchParty.referenceSeconds,
          resumeSeconds: startAt,
          isBeingAsked: watchParty.passwordWanted !== null,
          hasWaitedLongEnough: hasWaitedForTheRoom,
        });

  if (playing !== null && beginning.kind === 'wait') {
    return <SplashScreen name={initialTitle} label="Joining the watch party" />;
  }

  if (playing !== null && beginning.kind === 'begin') {
    begunRef.current = { mediaId: playing.id, atSeconds: beginning.atSeconds };
  }

  const begunAt = beginning.kind === 'begin' ? beginning.atSeconds : startAt;

  if (playing !== null) {
    return (
      <motion.main
        initial={{ opacity: 0, scale: prefersReducedMotion === true ? 1 : 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion === true ? 0.15 : 0.45, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-40 flex flex-col bg-black"
      >
        <VideoPlayer
          media={playing}
          startSeconds={begunAt}
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
            const found = progress.get(mediaId);

            return found === undefined ? undefined : watchedFraction(found);
          }}
          onProgress={(positionSeconds, durationSeconds) => {
            const entry = {
              mediaId: playing.id,
              positionSeconds,
              durationSeconds,
              isFinished: positionSeconds >= durationSeconds - FINISHED_WITHIN_SECONDS,
              updatedAt: new Date().toISOString(),
            };

            const whole = Math.floor(positionSeconds);

            if (Math.abs(whole - markedAtRef.current) < PROGRESS_EVERY_SECONDS) {
              return;
            }

            markedAtRef.current = whole;

            setReported((current) => new Map(current).set(playing.id, entry));
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
  }

  return (
    <AppShell
      section={section}
      onSectionChange={(next) => {
        go({
          section: next,
          search: next === 'search' ? place.search : '',
          genre: next === 'search' ? place.genre : null,
        });
      }}
      moodLights={section === 'home' ? moodLights : []}
      isAdministrator={user.role === 'admin'}
      surpriseKinds={surpriseKinds}
      notifications={
        <NotificationBell
          notifications={inbox.notifications}
          unread={inbox.unread}
          {...(pushKey === '' || !canReceivePush()
            ? {}
            : {
                push: {
                  isOn: isPushOn,
                  onToggle: () => {
                    void (
                      isPushOn ? unsubscribeFromPush().then(() => false) : subscribeToPush(pushKey)
                    ).then(setPushChoice);
                  },
                },
              })}
          onOpen={() => {
            void cache.invalidateQueries({ queryKey: notificationQueries.key });
          }}
          onRead={(id) => {
            void markNotificationsRead(id).then((unread) => {
              cache.setQueryData(notificationQueries.inbox().queryKey, (waiting) =>
                waiting === undefined
                  ? waiting
                  : {
                      unread,
                      notifications: waiting.notifications.map((one) =>
                        one.id === id && one.readAt === null
                          ? { ...one, readAt: new Date().toISOString() }
                          : one,
                      ),
                    },
              );
            });
          }}
          onReadAll={() => {
            void markNotificationsRead().then(() =>
              cache.invalidateQueries({ queryKey: notificationQueries.key }),
            );
          }}
          onFollow={(link) => {
            window.location.assign(link);
          }}
        />
      }
      onSurprise={(only) => {
        void pickAnything(only).then((found) => {
          if (found === null) {
            return;
          }

          if (found.kind === 'show') {
            go({ show: found.showId });

            return;
          }

          rememberItems([found.item]);
          go({ inspecting: found.item.id });
        });
      }}
      {...(watcher === null
        ? {}
        : { avatar: <ProfileFace profile={watcher} className="size-7 rounded-full text-xs" /> })}
    >
      <ShowDialog
        show={openShow}
        onClose={() => {
          go({ show: null });
        }}
        onPlay={(media, startSeconds) => {
          setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
          go({ playing: media.id, show: null });
        }}
        onInspect={(media) => {
          go({ inspecting: media.id });
        }}
        watchedFractionFor={(mediaId) => {
          const found = progress.get(mediaId);

          return found === undefined ? undefined : watchedFraction(found);
        }}
        resumeFor={(mediaId) => resumeFor(progress, mediaId)}
        isFinished={(mediaId) => progress.get(mediaId)?.isFinished === true}
        stars={
          (openShow?.seriesId ?? null) === null
            ? null
            : ratings.ratingFor({ seriesId: openShow?.seriesId ?? '' })
        }
        onRate={(show, stars) => {
          if ((show.seriesId ?? null) !== null) {
            ratings.rate({ seriesId: show.seriesId ?? '' }, stars);
          }
        }}
      />

      <MediaDetailDialog
        media={inspecting}
        siblings={inspecting === null ? [] : findSiblings([...known.values()], inspecting)}
        watchedFractionFor={(mediaId) => {
          const found = progress.get(mediaId);

          return found === undefined ? undefined : watchedFraction(found);
        }}
        onSelectSibling={(sibling) => {
          go({ inspecting: sibling.id });
        }}
        {...(inspecting !== null && resumeFor(progress, inspecting.id) !== null
          ? { resumeSeconds: resumeFor(progress, inspecting.id) ?? 0 }
          : {})}
        {...(openShow === null
          ? {}
          : {
              onBack: () => {
                go({ inspecting: null });
              },
              backLabel: openShow.title,
            })}
        isKept={inspecting !== null && favourites.isKept(inspecting.id)}
        onToggleKept={(media) => {
          favourites.toggle(media.id);
        }}
        stars={inspecting === null ? null : ratings.ratingFor({ mediaId: inspecting.id })}
        onRate={(media, stars) => {
          ratings.rate({ mediaId: media.id }, stars);
        }}
        onOpenPerson={(member) => {
          setOpenRole(member.role);
          go({ person: member.personId ?? null });
        }}
        onShare={(media) => {
          setSharing(media);
        }}
        onStartParty={(media) => {
          watchParty.open(media.id);
          go({ inspecting: null, playing: media.id });
        }}
        onClose={() => {
          go({ inspecting: null });
        }}
        onPlay={(media, startSeconds) => {
          setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
          go({ inspecting: null, playing: media.id });
        }}
      />

      <ShareDialog
        media={sharing}
        isOpen={sharing !== null}
        onClose={() => {
          setSharing(null);
        }}
      />

      <StillWatchingDialog
        isOpen={askingAbout !== null}
        title={askingAbout?.title ?? ''}
        secondsToAnswer={STILL_WATCHING_ANSWER_SECONDS}
        onCarryOn={() => {
          const following = askingAbout;

          setAskingAbout(null);

          if (following !== null) {
            carriedOnRef.current = 0;
            carriedOnToRef.current = null;
            go({ playing: following.id, inspecting: null });
          }
        }}
        onGiveUp={() => {
          const wasPlaying = place.playing;

          setAskingAbout(null);
          carriedOnRef.current = 0;
          carriedOnToRef.current = null;
          go({ playing: null, inspecting: wasPlaying });
        }}
      />

      <PersonDialog
        personId={place.person}
        role={openRole}
        onClose={() => {
          go({ person: null });
        }}
        onPlay={(media, startSeconds) => {
          setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
          go({ person: null, inspecting: null, playing: media.id });
        }}
        onInspect={(media) => {
          go({ person: null, inspecting: media.id });
        }}
        onOpenShow={(media) => {
          const series = media.seriesId ?? showSlug(media.seriesTitle ?? '');

          if (series !== '') {
            go({ person: null, show: series });
          }
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          variants={groupVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
          style={{ display: 'contents' }}
        >
          {section === 'admin' ? (
            <AdminArea
              initialPanel={place.adminPanel}
              onPanelChange={(panel) => {
                replace({ adminPanel: panel });
              }}
              initialJob={place.adminJob}
              onJobChange={(kind) => {
                replace({ adminJob: kind });
              }}
            />
          ) : section === 'account' ? (
            <AccountArea
              user={user}
              onChanged={() => {
                void refresh();
              }}
              onSignOut={() => {
                void signOut().then(() => {
                  go({
                    section: 'home',
                    search: '',
                    inspecting: null,
                    playing: null,
                  });

                  return refresh();
                });
              }}
            />
          ) : section === 'shows' ||
            section === 'films' ||
            section === 'new' ||
            section === 'favourites' ? (
            <BrowseArea
              kind={section}
              favourites={[...favourites.kept]}
              onPlay={(media, startSeconds) => {
                setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
                go({ playing: media.id });
              }}
              onInspect={(media) => {
                go({ inspecting: media.id });
              }}
              onOpenShow={(media) => {
                const series = media.seriesId ?? showSlug(media.seriesTitle ?? '');

                if (series !== '') {
                  go({ show: series });
                }
              }}
              onItemsLoaded={rememberItems}
              watchedFractionFor={(mediaId) => {
                const found = progress.get(mediaId);

                return found === undefined ? undefined : watchedFraction(found);
              }}
              resumeFor={(mediaId) => resumeFor(progress, mediaId)}
              isKept={favourites.isKept}
              onToggleKept={(media) => {
                favourites.toggle(media.id);
              }}
            />
          ) : section === 'search' ? (
            <SearchArea
              search={place.search}
              onSearchChange={(next) => {
                replace({ search: next });
              }}
              genre={place.genre}
              onGenreChange={(next) => {
                replace({ genre: next });
              }}
              onPlay={(media, startSeconds) => {
                setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
                go({ playing: media.id });
              }}
              onInspect={(media) => {
                go({ inspecting: media.id });
              }}
              onItemsLoaded={rememberItems}
              watchedFractionFor={(mediaId) => {
                const found = progress.get(mediaId);

                return found === undefined ? undefined : watchedFraction(found);
              }}
              resumeFor={(mediaId) => resumeFor(progress, mediaId)}
              isKept={favourites.isKept}
              onToggleKept={(media) => {
                favourites.toggle(media.id);
              }}
            />
          ) : (
            <LibraryBrowser
              name={initialTitle}
              search={place.search}
              libraryId={place.library}
              onLibraryChange={(libraryId) => {
                replace({ library: libraryId });
              }}
              onPlay={(media) => {
                go({ inspecting: media.id });
              }}
              onShow={(seriesId) => {
                go({ show: seriesId });
              }}
              onWatch={(media, startSeconds) => {
                setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
                go({ playing: media.id });
              }}
              onItemsLoaded={rememberItems}
              hasHero
              onFeatureChange={setFeatured}
              onPalette={setMoodLights}
              onOpenShow={(media) => {
                const series = media.seriesId ?? showSlug(media.seriesTitle ?? '');

                if (series !== '') {
                  go({ show: series });
                }
              }}
              isKept={favourites.isKept}
              onToggleKept={(media) => {
                favourites.toggle(media.id);
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
};

App.displayName = 'App';

export { App };
