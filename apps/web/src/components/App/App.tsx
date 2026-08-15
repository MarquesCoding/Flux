import type { MoodLight } from '@FluxUI/MoodBackground.types';
import type { ShowSummary } from '@FluxContracts/schemas/Show';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace';
import { fetchProfiles } from '@FluxWeb/profiles/fetchProfiles';
import { readCurrentProfile } from '@FluxWeb/profiles/currentProfile';
import { pickAnything } from '@FluxWeb/library/pickAnything';
import { NotificationBell } from '@FluxWeb/components/NotificationBell/NotificationBell';
import {
  fetchNotificationSettings,
  fetchNotifications,
  markNotificationsRead,
} from '@FluxWeb/notifications/fetchNotifications';
import {
  canReceivePush,
  subscribeToPush,
  unsubscribeFromPush,
} from '@FluxWeb/notifications/subscribeToPush';
import type { Inbox } from '@FluxWeb/notifications/fetchNotifications';
import { VideoPlayer } from '@FluxWeb/components/VideoPlayer/VideoPlayer';
import { MediaDetailDialog } from '@FluxWeb/components/MediaDetailDialog/MediaDetailDialog';
import { AppShell } from '@FluxWeb/components/AppShell/AppShell';
import { SplashScreen } from '@FluxUI/SplashScreen';
import { AdminArea } from '@FluxWeb/components/AdminArea/AdminArea';
import { AccountArea } from '@FluxWeb/components/AccountArea/AccountArea';
import { ProfileGate } from '@FluxWeb/components/ProfileGate/ProfileGate';
import { usePlace } from '@FluxWeb/navigation/usePlace';
import { findSiblings, nextEpisode } from '@FluxWeb/library/pickFeatured';
import { fetchWatchProgress, byMediaId } from '@FluxWeb/playback/watchProgress';
import { summariseDetail } from '@FluxWeb/library/summariseDetail';
import { watchPresence } from '@FluxWeb/presence/watchPresence';
import {
  isWorthResuming,
  watchedFraction,
  FINISHED_WITHIN_SECONDS,
} from '@FluxContracts/schemas/WatchProgress';
import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types';
import { fetchSession } from '@FluxWeb/session/fetchSession';
import { signOut } from '@FluxWeb/session/signOut';
import { SetupStatusSchema } from '@FluxContracts/schemas/Setup';
import type { SetupStatus } from '@FluxContracts/schemas/Setup';
import type { SessionUser } from '@FluxContracts/schemas/Session';
import type { LibraryKind, MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';
import type { AppProps } from './App.types';

type LoadState = 'loading' | 'ready' | 'unreachable';

/**
 * How often what is held about a position is brought up to date.
 *
 * The player reports several times a second, which is the right rate for a
 * scrubber and far too fast for anything that causes a render. What this holds
 * is only read by cards and by the resume, so a few seconds behind is close
 * enough — and the report the server gets is on its own clock anyway.
 */
const PROGRESS_EVERY_SECONDS = 5;

/**
 * Application shell and routing.
 *
 * Setup, sign-in and the library are chosen from what the server reports, not
 * from local state, so a second browser cannot skip setup and a stale tab
 * cannot behave as though it is still signed in.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [progress, setProgress] = useState(new Map<string, WatchProgress>());
  const reportedRef = useRef(new Map<string, WatchProgress>());
  /**
   * The second last written into what this holds about progress.
   *
   * A ref rather than state: it decides whether to write, and writing is what
   * causes the render — keeping it in state would cause the render it is meant
   * to be rationing.
   */
  const markedAtRef = useRef(0);
  /**
   * Where to start something in spite of what the server holds.
   *
   * Only "Start again" needs this. Everything else resumes, and the position to
   * resume from is the server's to answer — but somebody who has just asked to
   * watch a film from the beginning is asking for the one thing that answer
   * cannot express, and it lasts until they open something else.
   */
  const [startOverride, setStartOverride] = useState<{ mediaId: string; seconds: number } | null>(
    null,
  );
  /**
   * Whether the server has been asked where this viewer got to.
   *
   * The player is told where to start once, when it mounts, so opening it
   * before the answer has arrived opens it at the beginning and there is no
   * second chance to correct that.
   */
  const [hasReadProgress, setHasReadProgress] = useState(false);
  const [, setFeatured] = useState<MediaSummary | null>(null);
  const [moodLights, setMoodLights] = useState<MoodLight[]>([]);
  const favourites = useFavourites();
  const [openShow, setOpenShow] = useState<ShowSummary | null>(null);
  const [watcher, setWatcher] = useState<ViewerProfile | null>(null);

  useEffect(() => {
    const chosen = readCurrentProfile();

    if (chosen === null) {
      setWatcher(null);

      return;
    }

    void fetchProfiles().then((people) => {
      setWatcher(people.find((person) => person.id === chosen) ?? null);
    });
  }, [user]);
  const [known, setKnown] = useState(new Map<string, MediaSummary>());
  const { place, go, replace } = usePlace();
  const prefersReducedMotion = useReducedMotion();

  const [surpriseKinds, setSurpriseKinds] = useState<LibraryKind[]>([]);
  const [inbox, setInbox] = useState<Inbox>({ notifications: [], unread: 0 });
  const [pushKey, setPushKey] = useState('');
  const [isPushOn, setIsPushOn] = useState(false);

  useEffect(() => {
    let abandoned = false;

    void fetchNotifications().then((read) => {
      if (!abandoned) {
        setInbox(read);
      }
    });

    void fetchNotificationSettings().then((settings) => {
      if (abandoned) {
        return;
      }

      setPushKey(settings.pushPublicKey);
      setIsPushOn(settings.preferences.some((one) => one.push));
    });

    return () => {
      abandoned = true;
    };
  }, []);

  useEffect(() => {
    let abandoned = false;

    void fetchLibraries()
      .then((libraries) => {
        if (!abandoned) {
          setSurpriseKinds([...new Set(libraries.map((one) => one.kind))]);
        }
      })
      .catch(() => {
        setSurpriseKinds([]);
      });

    return () => {
      abandoned = true;
    };
  }, []);

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
   * Where this viewer left an item, when it is worth coming back to.
   *
   * For the offer to resume that a card or a hero makes, which is why it is
   * choosy: nobody wants to be asked whether to carry on with a film they
   * opened for thirty seconds last week.
   */
  const resumeFor = (mediaId: string): number | null => {
    const found = progress.get(mediaId);

    return found !== undefined && isWorthResuming(found) ? found.positionSeconds : null;
  };

  /**
   * Where something actually got to, for picking it up again.
   *
   * Deliberately not the same question as `resumeFor`. Whether to *offer* to
   * resume is a judgement about whether somebody meant to start something;
   * where to start once they are already watching is a fact, and a page that
   * reloads forty seconds into a film should carry on at forty seconds rather
   * than be told that does not count as having started.
   *
   * Something already finished starts again, since carrying on from the credits
   * is not carrying on.
   */
  const positionFor = (mediaId: string): number => {
    const found = progress.get(mediaId);

    return found === undefined || found.isFinished ? 0 : Math.floor(found.positionSeconds);
  };

  /**
   * Keeps what the library has shown, so an address naming an item can be
   * turned back into one.
   *
   * Stable, because a callback rebuilt on every render is a callback that
   * makes anything depending on it run again.
   */
  const rememberItems = useCallback((items: MediaSummary[]) => {
    setKnown((current) => {
      const next = new Map(current);

      for (const item of items) {
        next.set(item.id, item);
      }

      return next;
    });
  }, []);

  const readProgress = useCallback(async () => {
    const fromServer = byMediaId(await fetchWatchProgress());
    const merged = new Map(fromServer);

    for (const [mediaId, mine] of reportedRef.current) {
      const theirs = fromServer.get(mediaId);

      if (theirs !== undefined && Math.abs(theirs.positionSeconds - mine.positionSeconds) <= 1) {
        reportedRef.current.delete(mediaId);

        continue;
      }

      merged.set(mediaId, mine);
    }

    setProgress(merged);
    setHasReadProgress(true);
  }, []);

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
    try {
      const response = await fetch('/api/setup/status');

      if (!response.ok) {
        setLoadState('unreachable');

        return;
      }

      const nextStatus = SetupStatusSchema.parse(await response.json());

      setStatus(nextStatus);
      setUser(nextStatus.isComplete ? await fetchSession() : null);
      setLoadState('ready');
    } catch {
      setLoadState('unreachable');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  if (loadState === 'loading') {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />;
  }

  if (loadState === 'unreachable' || status === null) {
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

  /**
   * Where the thing being watched should start.
   *
   * The address wins when it names a second, since a link somebody was sent is
   * a link to a moment. Otherwise it is wherever the server says this viewer
   * got to — which is what makes a reload carry on rather than start again,
   * given that the address of something opened from a card names no second at
   * all.
   */
  const startAt =
    playing === null
      ? 0
      : startOverride?.mediaId === playing.id
        ? startOverride.seconds
        : positionFor(playing.id);

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
          startSeconds={startAt}
          isImmersive
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

            reportedRef.current.set(playing.id, entry);

            const whole = Math.floor(positionSeconds);

            if (Math.abs(whole - markedAtRef.current) < PROGRESS_EVERY_SECONDS) {
              return;
            }

            markedAtRef.current = whole;

            setProgress((current) => {
              const next = new Map(current);

              next.set(playing.id, entry);

              return next;
            });
          }}
          onEnded={() => {
            const following = nextEpisode([...known.values()], playing);

            if (following === null) {
              go({ playing: null, inspecting: playing.id });

              return;
            }

            go({ playing: following.id, inspecting: null });
          }}
          onClose={() => {
            go({ playing: null, inspecting: playing.id });
            void readProgress();
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
                    ).then(setIsPushOn);
                  },
                },
              })}
          onOpen={() => {
            void fetchNotifications().then(setInbox);
          }}
          onRead={(id) => {
            void markNotificationsRead(id).then((unread) => {
              setInbox((held) => ({
                unread,
                notifications: held.notifications.map((one) =>
                  one.id === id && one.readAt === null
                    ? { ...one, readAt: new Date().toISOString() }
                    : one,
                ),
              }));
            });
          }}
          onReadAll={() => {
            void markNotificationsRead().then(() => {
              void fetchNotifications().then(setInbox);
            });
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
        resumeFor={resumeFor}
        isFinished={(mediaId) => progress.get(mediaId)?.isFinished === true}
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
        {...(inspecting !== null && resumeFor(inspecting.id) !== null
          ? { resumeSeconds: resumeFor(inspecting.id) ?? 0 }
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
        onClose={() => {
          go({ inspecting: null });
        }}
        onPlay={(media, startSeconds) => {
          setStartOverride({ mediaId: media.id, seconds: Math.floor(startSeconds) });
          go({ inspecting: null, playing: media.id });
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
              onItemsLoaded={rememberItems}
              watchedFractionFor={(mediaId) => {
                const found = progress.get(mediaId);

                return found === undefined ? undefined : watchedFraction(found);
              }}
              resumeFor={resumeFor}
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
              resumeFor={resumeFor}
              isKept={favourites.isKept}
              onToggleKept={(media) => {
                favourites.toggle(media.id);
              }}
            />
          ) : (
            <LibraryBrowser
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
                /**
                 * The programme's own id, or a slug of its title where there
                 * is none.
                 *
                 * The slug is only reached by an item scanned before
                 * programmes were rows of their own, and it carries the fault
                 * it always had: two programmes of one name are one address.
                 * The first scan after this gives every episode an id and the
                 * fallback stops being reachable.
                 */
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
