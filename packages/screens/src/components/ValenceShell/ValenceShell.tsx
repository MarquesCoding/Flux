import { useEffect, useMemo, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { groupVariants } from '@ValenceUI/animations/reveal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@ValenceScreens/components/AppShell/AppShell';
import { ShowDialog } from '@ValenceScreens/components/ShowDialog/ShowDialog';
import { MediaDetailDialog } from '@ValenceScreens/components/MediaDetailDialog/MediaDetailDialog';
import { PersonDialog } from '@ValenceScreens/components/PersonDialog/PersonDialog';
import { AccountDialog } from '@ValenceScreens/components/AccountDialog/AccountDialog';
import { AdminDialog } from '@ValenceScreens/components/AdminDialog/AdminDialog';
import { DownloadsDialog } from '@ValenceScreens/components/DownloadsDialog/DownloadsDialog';
import { ShareDialog } from '@ValenceScreens/components/ShareDialog/ShareDialog';
import type { ShareSubject } from '@ValenceScreens/components/ShareDialog/ShareDialog.types';
import { StillWatchingDialog } from '@ValenceScreens/components/StillWatchingDialog/StillWatchingDialog';
import { NotificationBell } from '@ValenceScreens/components/NotificationBell/NotificationBell';
import { ProfileFace } from '@ValenceScreens/components/ProfileFace/ProfileFace';
import {
  clearNotifications,
  markNotificationsRead,
} from '@ValenceClient/notifications/fetchNotifications';
import {
  canReceivePush,
  subscribeToPush,
  unsubscribeFromPush,
} from '@ValenceScreens/notifications/subscribeToPush';
import { notificationQueries } from '@ValenceClient/query/notificationQueries';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { useFavourites } from '@ValenceClient/library/useFavourites';
import { useRate } from '@ValenceClient/library/useRate';
import { pickAnything } from '@ValenceClient/library/pickAnything';
import { findSiblings } from '@ValenceClient/library/pickFeatured';
import { showSlug } from '@ValenceCore/functions/showSlug';
import { watchedFraction } from '@ValenceContracts/schemas/WatchProgress';
import { STILL_WATCHING_ANSWER_SECONDS } from '@ValenceContracts/schemas/StillWatching';
import { resumeFor } from '@ValenceClient/playback/resumeFor';
import { ACCOUNT_OPENS_ON, ADMIN_OPENS_ON } from '@ValenceClient/navigation/readLocation';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useSignOut } from '@ValenceScreens/session/useSignOut';
import { useShell } from '@ValenceClient/shell/useShell';
import { useWhatIMayDo } from '@ValenceClient/session/useWhatIMayDo';
import type { ShowSummary } from '@ValenceContracts/schemas/Show';
import type { ShellSection } from '@ValenceScreens/components/AppShell/AppShell.types';
import type { Inbox } from '@ValenceClient/notifications/fetchNotifications';

const NOTHING_WAITING = { notifications: [], unread: 0 };

/**
 * The chrome every section sits inside: the dock, the bell, the mood behind it, and the dialogs that
 * sit over whichever section is showing. The dialogs live here rather than in the pages because they
 * are opened from the address and outlive the page that opened them.
 */
const ValenceShell = () => {
  const cache = useQueryClient();
  const { place, go, replace } = usePlace();

  const {
    user,
    watcher,
    known,
    rememberItems,
    progress,
    moodLights,
    setStartOverride,
    askingAbout,
    setAskingAbout,
    watchParty,
    isHoldingTheScreen,
  } = useShell();

  const favourites = useFavourites(user.id);
  const rate = useRate(user.id);
  const { mayAdminister } = useWhatIMayDo();
  const leave = useSignOut();

  const [openShow, setOpenShow] = useState<ShowSummary | null>(null);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [sharing, setSharing] = useState<ShareSubject | null>(null);
  const [pushChoice, setPushChoice] = useState<boolean | null>(null);

  const held = useQuery(notificationQueries.inbox());
  const inbox = held.data ?? NOTHING_WAITING;

  const howToPush = useQuery(notificationQueries.settings());
  const pushKey = howToPush.data?.pushPublicKey ?? '';

  const isPushOn = pushChoice ?? howToPush.data?.preferences.some((one) => one.push) ?? false;

  const libraries = useQuery(libraryQueries.all());

  const libraryKinds = [...new Set((libraries.data ?? []).map((one) => one.kind))];

  const watchableIds = useMemo(
    () =>
      (libraries.data ?? [])
        .filter((one) => one.kind === 'movies' || one.kind === 'shows')
        .map((one) => one.id),
    [libraries.data],
  );

  const anyFilm = useQuery({
    ...libraryQueries.across(watchableIds, { kind: 'films', limit: 1 }),
    enabled: watchableIds.length > 0,
  });

  const isStockKnown = libraries.data !== undefined && !anyFilm.isLoading;

  const stocked: ShellSection[] = [
    ...((anyFilm.data ?? []).length > 0 ? (['films'] as const) : []),
    ...((libraries.data ?? []).some((one) => one.kind === 'shows' && one.itemCount > 0)
      ? (['shows'] as const)
      : []),
    ...((libraries.data ?? []).some((one) => one.kind === 'books' && one.itemCount > 0)
      ? (['read'] as const)
      : []),
  ];

  const inspecting = place.inspecting === null ? null : (known.get(place.inspecting) ?? null);

  useEffect(() => {
    if (place.show === null) {
      setOpenShow(null);

      return;
    }

    if (openShow?.id === place.show) {
      return;
    }

    let abandoned = false;

    void cache
      .ensureQueryData(libraryQueries.all())
      .then(async (found) => {
        for (const entry of found) {
          const shows = await cache.ensureQueryData(libraryQueries.shows(entry.id));
          const wanted = shows.find((one) => one.id === place.show);

          if (wanted !== undefined) {
            return wanted;
          }
        }

        return null;
      })
      .catch(() => null)
      .then((found) => {
        if (!abandoned) {
          setOpenShow(found);
        }
      });

    return () => {
      abandoned = true;
    };
  }, [place.show, openShow, cache]);

  return (
    <AppShell
      section={place.section}
      onSectionChange={(next) => {
        go({
          section: next,
          search: next === 'search' ? place.search : '',
          genre: next === 'search' ? place.genre : null,
        });
      }}
      isAccountOpen={place.account !== null}
      onOpenAccount={() => {
        go({ account: ACCOUNT_OPENS_ON });
      }}
      isAdminOpen={mayAdminister && place.admin !== null}
      onOpenAdmin={() => {
        go({ admin: ADMIN_OPENS_ON });
      }}
      isDownloadsOpen={place.downloads}
      onOpenDownloads={() => {
        go({ downloads: true });
      }}
      moodLights={place.section === 'home' ? moodLights : []}
      isAdministrator={mayAdminister}
      hasMark={!isHoldingTheScreen}
      {...(libraries.data === undefined ? {} : { libraryKinds })}
      {...(isStockKnown ? { stocked } : {})}
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
              cache.setQueryData(
                notificationQueries.inbox().queryKey,
                (waiting: Inbox | undefined) =>
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
          onClearAll={() => {
            void clearNotifications().then(() =>
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
      onSignOut={() => {
        void leave();
      }}
      {...(watcher === null
        ? {}
        : { avatar: <ProfileFace profile={watcher} className="size-7 rounded-full text-xs" /> })}
    >
      <ShowDialog
        show={openShow}
        onShare={(show) => {
          setSharing({ kind: 'series', seriesId: show.seriesId ?? '', title: show.title });
        }}
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
        onRate={(show, stars) => {
          if ((show.seriesId ?? null) !== null) {
            rate({ seriesId: show.seriesId ?? '' }, stars);
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
        onRate={(media, stars) => {
          rate({ mediaId: media.id }, stars);
        }}
        onOpenPerson={(member) => {
          setOpenRole(member.role);
          go({ person: member.personId ?? null });
        }}
        onShare={(media) => {
          setSharing({ kind: 'item', media });
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

      <AccountDialog
        panel={place.account}
        onPanel={(next) => {
          go({ account: next });
        }}
        onClose={() => {
          go({ account: null });
        }}
      />

      <DownloadsDialog
        isOpen={place.downloads}
        onClose={() => {
          go({ downloads: false });
        }}
      />

      <AdminDialog
        panel={mayAdminister ? place.admin : null}
        job={place.adminJob}
        onPanel={(next) => {
          replace({ admin: next, adminJob: null });
        }}
        onJob={(next) => {
          replace({ adminJob: next });
        }}
        onClose={() => {
          go({ admin: null, adminJob: null });
        }}
      />

      <ShareDialog
        subject={sharing}
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
            go({ playing: following.id, inspecting: null });
          }
        }}
        onGiveUp={() => {
          const wasPlaying = place.playing;

          setAskingAbout(null);
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
          key={place.section}
          variants={groupVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
          style={{ display: 'contents' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
};

ValenceShell.displayName = 'ValenceShell';

export { ValenceShell };
