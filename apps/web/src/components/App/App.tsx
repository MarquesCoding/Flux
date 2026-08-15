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

const PROGRESS_EVERY_SECONDS = 5;

/**
 * Application shell and routing.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [progress, setProgress] = useState(new Map<string, WatchProgress>());
  const reportedRef = useRef(new Map<string, WatchProgress>());
  const markedAtRef = useRef(0);
  const [startOverride, setStartOverride] = useState<{ mediaId: string; seconds: number } | null>(
    null,
  );
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
   */
  const resumeFor = (mediaId: string): number | null => {
    const found = progress.get(mediaId);

    return found !== undefined && isWorthResuming(found) ? found.positionSeconds : null;
  };

  /**
   * Where something actually got to, for picking it up again.
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

  const readProgress = useCallback(async () => {
    const answer = await fetchWatchProgress();

    if (answer === null) {
      return;
    }

    const fromServer = byMediaId(answer);
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
