import type { MoodLight } from '@FluxUI/MoodBackground.types'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import LibraryBrowserModule from '@FluxWeb/components/LibraryBrowser/LibraryBrowser'
import SearchAreaModule from '@FluxWeb/components/SearchArea/SearchArea'
import BrowseAreaModule from '@FluxWeb/components/BrowseArea/BrowseArea'
import useFavouritesModule from '@FluxWeb/library/useFavourites'
import ProfileFaceModule from '@FluxWeb/components/ProfileFace/ProfileFace'
import fetchProfilesModule from '@FluxWeb/profiles/fetchProfiles'
import currentProfileModule from '@FluxWeb/profiles/currentProfile'
import pickAnythingModule from '@FluxWeb/library/pickAnything'
import VideoPlayerModule from '@FluxWeb/components/VideoPlayer/VideoPlayer'
import MediaDetailDialogModule from '@FluxWeb/components/MediaDetailDialog/MediaDetailDialog'
import AppShellModule from '@FluxWeb/components/AppShell/AppShell'
import SplashScreenModule from '@FluxUI/SplashScreen'
import AdminAreaModule from '@FluxWeb/components/AdminArea/AdminArea'
import AccountAreaModule from '@FluxWeb/components/AccountArea/AccountArea'
import ProfileGateModule from '@FluxWeb/components/ProfileGate/ProfileGate'
import usePlaceModule from '@FluxWeb/navigation/usePlace'
import pickFeaturedModule from '@FluxWeb/library/pickFeatured'
import watchProgressModule from '@FluxWeb/playback/watchProgress'
import WatchProgressContract from '@FluxContracts/schemas/WatchProgress'
import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types'
import fetchSessionModule from '@FluxWeb/session/fetchSession'
import signOutModule from '@FluxWeb/session/signOut'
import SetupModule from '@FluxContracts/schemas/Setup'
import type { SetupStatus } from '@FluxContracts/schemas/Setup'
import type { SessionUser } from '@FluxContracts/schemas/Session'
import type { MediaSummary } from '@FluxContracts/schemas/Library'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'
import type { AppProps } from './App.types'

const { SetupWizard } = SetupWizardModule
const { LibraryBrowser } = LibraryBrowserModule
const { SearchArea } = SearchAreaModule
const { BrowseArea } = BrowseAreaModule
const { useFavourites } = useFavouritesModule
const { ProfileFace } = ProfileFaceModule
const { fetchProfiles } = fetchProfilesModule
const { readCurrentProfile } = currentProfileModule
const { pickAnything } = pickAnythingModule
const { VideoPlayer } = VideoPlayerModule
const { MediaDetailDialog } = MediaDetailDialogModule
const { AppShell } = AppShellModule
const { SplashScreen } = SplashScreenModule
const { AdminArea } = AdminAreaModule
const { AccountArea } = AccountAreaModule
const { ProfileGate } = ProfileGateModule
const { usePlace } = usePlaceModule
const { findSiblings, nextEpisode } = pickFeaturedModule
const { fetchWatchProgress, byMediaId } = watchProgressModule
const { isWorthResuming, watchedFraction, FINISHED_WITHIN_SECONDS } = WatchProgressContract

const { fetchSession } = fetchSessionModule
const { signOut } = signOutModule
const { SetupStatusSchema } = SetupModule

type LoadState = 'loading' | 'ready' | 'unreachable'

/**
 * Application shell and routing.
 *
 * Setup, sign-in and the library are chosen from what the server reports, not
 * from local state, so a second browser cannot skip setup and a stale tab
 * cannot behave as though it is still signed in.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [progress, setProgress] = useState(new Map<string, WatchProgress>())
  // What this session has said and not yet seen come back. The server is told
  // on a timer and again on the way out, neither of which a read waits for, so
  // a read that lands in between would put the old position back on the card —
  // which is why watching something and closing it sometimes left the bar
  // where it had been an hour ago.
  const reportedRef = useRef(new Map<string, WatchProgress>())
  const [, setFeatured] = useState<MediaSummary | null>(null)
  // What the page is lit by, read from whatever is on screen rather than
  // decided when the file was imported.
  const [moodLights, setMoodLights] = useState<MoodLight[]>([])
  const favourites = useFavourites()
  // Who is watching, for the face on the account button. Read here rather than
  // in the shell: the shell draws a frame and should not be the thing that
  // knows how profiles work.
  const [watcher, setWatcher] = useState<ViewerProfile | null>(null)

  useEffect(() => {
    const chosen = readCurrentProfile()

    if (chosen === null) {
      setWatcher(null)

      return
    }

    void fetchProfiles().then((people) => {
      setWatcher(people.find((person) => person.id === chosen) ?? null)
    })
  }, [user])
  // Everything the library has shown, so an address naming an item can be
  // turned back into one without asking the server a second time.
  const [known, setKnown] = useState(new Map<string, MediaSummary>())
  const { place, go, replace } = usePlace()
  const prefersReducedMotion = useReducedMotion()

  const section: ShellSection = place.section
  const inspecting = place.inspecting === null ? null : (known.get(place.inspecting) ?? null)
  const playing = place.playing === null ? null : (known.get(place.playing) ?? null)

  /**
   * Forgets who was watching on this device.
   */
  /**
   * Where this viewer left an item, when it is worth coming back to.
   */
  const resumeFor = (mediaId: string): number | null => {
    const found = progress.get(mediaId)

    return found !== undefined && isWorthResuming(found) ? found.positionSeconds : null
  }

  /**
   * Keeps what the library has shown, so an address naming an item can be
   * turned back into one.
   *
   * Stable, because a callback rebuilt on every render is a callback that
   * makes anything depending on it run again.
   */
  const rememberItems = useCallback((items: MediaSummary[]) => {
    setKnown((current) => {
      const next = new Map(current)

      for (const item of items) {
        next.set(item.id, item)
      }

      return next
    })
  }, [])

  const readProgress = useCallback(async () => {
    const fromServer = byMediaId(await fetchWatchProgress())
    const merged = new Map(fromServer)

    for (const [mediaId, mine] of reportedRef.current) {
      const theirs = fromServer.get(mediaId)

      // Caught up: what came back is what was sent, so this copy stops
      // standing in for it. Compared rather than trusted to be larger,
      // because rewinding is a smaller number and still the right one.
      if (theirs !== undefined && Math.abs(theirs.positionSeconds - mine.positionSeconds) <= 1) {
        reportedRef.current.delete(mediaId)

        continue
      }

      merged.set(mediaId, mine)
    }

    setProgress(merged)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/setup/status')

      if (!response.ok) {
        setLoadState('unreachable')

        return
      }

      const nextStatus = SetupStatusSchema.parse(await response.json())

      setStatus(nextStatus)
      setUser(nextStatus.isComplete ? await fetchSession() : null)
      setLoadState('ready')
    } catch {
      setLoadState('unreachable')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Read once there is somebody to read them for. Asking before sign-in would
  // be a request that can only ever answer with nobody.
  useEffect(() => {
    if (user !== null) {
      void readProgress()
    }
  }, [user, readProgress])

  if (loadState === 'loading') {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />
  }

  if (loadState === 'unreachable' || status === null) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-2 p-8">
        <h1 className="text-2xl font-semibold text-text">Flux is not reachable</h1>
        <p className="text-text-muted">
          The server did not respond. Check that it is running and reload the page.
        </p>
      </main>
    )
  }

  if (!status.isComplete) {
    return (
      <SetupWizard
        status={status}
        onComplete={() => {
          void refresh()
        }}
      />
    )
  }

  if (user === null) {
    return (
      <ProfileGate
        name={initialTitle}
        onSignedIn={() => {
          // Home, whatever address they arrived on. Somebody signing in has
          // just started; dropping them into the admin page or a half watched
          // film because that is where the last person was is not where they
          // meant to go.
          go({ section: 'home', search: '', inspecting: null, playing: null, startSeconds: 0 })
          void refresh()
        }}
      />
    )
  }

  // Watching is not a thing that happens inside a library page. The player
  // takes the whole viewport so nothing else competes with it, and escape or
  // closing puts the library back exactly where it was.
  if (playing !== null) {
    return (
      // The player does not appear, it takes over: the picture swells out of
      // the page behind it and the page darkens under it, which is the same
      // move whether it was opened from a dialog or landed on by refreshing
      // an address. A screen that simply exists where another one was reads
      // as a page having been replaced rather than as a film starting.
      <motion.main
        initial={{ opacity: 0, scale: prefersReducedMotion === true ? 1 : 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion === true ? 0.15 : 0.45, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-40 flex flex-col bg-black"
      >
        <VideoPlayer
          media={playing}
          startSeconds={place.startSeconds}
          isImmersive
          // The whole season in order, and nothing at all for a film: a list
          // of one episode is a button that opens onto what is already
          // playing.
          episodes={
            playing.seriesTitle === null || playing.seriesTitle === undefined
              ? []
              : [playing, ...findSiblings([...known.values()], playing)].sort(
                  (left, right) => (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0),
                )
          }
          onSelectEpisode={(episode) => {
            go({ playing: episode.id, startSeconds: Math.floor(resumeFor(episode.id) ?? 0) })
          }}
          watchedFractionFor={(mediaId) => {
            const found = progress.get(mediaId)

            return found === undefined ? undefined : watchedFraction(found)
          }}
          // Kept here as it happens rather than read back afterwards: the
          // server is told on a timer, and a card that waits for that round
          // trip shows the wrong place every time somebody closes a film.
          onProgress={(positionSeconds, durationSeconds) => {
            const entry = {
              mediaId: playing.id,
              positionSeconds,
              durationSeconds,
              isFinished: positionSeconds >= durationSeconds - FINISHED_WITHIN_SECONDS,
              updatedAt: new Date().toISOString(),
            }

            reportedRef.current.set(playing.id, entry)

            setProgress((current) => {
              const next = new Map(current)

              next.set(playing.id, entry)

              return next
            })
          }}
          // One episode runs into the next, which is the whole point of a
          // season. A film has nothing after it, so the player closes back to
          // the page about it.
          onEnded={() => {
            const following = nextEpisode([...known.values()], playing)

            if (following === null) {
              go({ playing: null, startSeconds: 0, inspecting: playing.id })

              return
            }

            go({ playing: following.id, startSeconds: 0, inspecting: null })
          }}
          onClose={() => {
            // Back to where they came from, not out to the library: someone
            // leaving a film usually wants the page about it, whether to read
            // the rest of it or to pick the next episode.
            go({ playing: null, startSeconds: 0, inspecting: playing.id })
            void readProgress()
          }}
        />
      </motion.main>
    )
  }

  return (
    <AppShell
      section={section}
      onSectionChange={(next) => {
        // Leaving search abandons the search. Carrying the term out with them
        // leaves home showing a filtered library and no hero, which reads as
        // the page having broken.
        go({ section: next, search: next === 'search' ? place.search : '' })
      }}
      // The page takes its light from whatever the viewer is looking at, read
      // out of the picture itself — and only where there is something to look
      // at. A page of results or an account form has nothing to spill onto it,
      // so it goes back to the house colour rather than keeping the light of a
      // film the viewer has navigated away from.
      moodLights={section === 'home' ? moodLights : []}
      isAdministrator={user.role === 'admin'}
      // Something at random, opened as its own page rather than played
      // outright: being thrown into a film nobody chose is a worse surprise
      // than being shown one and asked.
      onSurprise={() => {
        void pickAnything().then((found) => {
          if (found === null) {
            return
          }

          rememberItems([found])
          go({ inspecting: found.id })
        })
      }}
      {...(watcher === null
        ? {}
        : { avatar: <ProfileFace profile={watcher} className="size-7 rounded-full text-xs" /> })}
    >
      <MediaDetailDialog
        media={inspecting}
        siblings={inspecting === null ? [] : findSiblings([...known.values()], inspecting)}
        watchedFractionFor={(mediaId) => {
          const found = progress.get(mediaId)

          return found === undefined ? undefined : watchedFraction(found)
        }}
        onSelectSibling={(sibling) => {
          go({ inspecting: sibling.id })
        }}
        {...(inspecting !== null && resumeFor(inspecting.id) !== null
          ? { resumeSeconds: resumeFor(inspecting.id) ?? 0 }
          : {})}
        isKept={inspecting !== null && favourites.isKept(inspecting.id)}
        onToggleKept={(media) => {
          favourites.toggle(media.id)
        }}
        onClose={() => {
          go({ inspecting: null })
        }}
        onPlay={(media, startSeconds) => {
          go({ inspecting: null, playing: media.id, startSeconds })
        }}
      />

      {section === 'admin' ? (
        <AdminArea />
      ) : section === 'account' ? (
        <AccountArea
          user={user}
          onChanged={() => {
            void refresh()
          }}
          onSignOut={() => {
            void signOut().then(() => {
              go({ section: 'home', search: '', inspecting: null, playing: null, startSeconds: 0 })

              return refresh()
            })
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
            go({ playing: media.id, startSeconds: Math.floor(startSeconds) })
          }}
          onInspect={(media) => {
            go({ inspecting: media.id })
          }}
          onItemsLoaded={rememberItems}
          watchedFractionFor={(mediaId) => {
            const found = progress.get(mediaId)

            return found === undefined ? undefined : watchedFraction(found)
          }}
          resumeFor={resumeFor}
          isKept={favourites.isKept}
          onToggleKept={(media) => {
            favourites.toggle(media.id)
          }}
        />
      ) : section === 'search' ? (
        <SearchArea
          search={place.search}
          onSearchChange={(next) => {
            // Replaced rather than pushed: a search box would otherwise fill
            // the history with one entry per letter typed.
            replace({ search: next })
          }}
          onPlay={(media, startSeconds) => {
            go({ playing: media.id, startSeconds: Math.floor(startSeconds) })
          }}
          onInspect={(media) => {
            go({ inspecting: media.id })
          }}
          onItemsLoaded={rememberItems}
          watchedFractionFor={(mediaId) => {
            const found = progress.get(mediaId)

            return found === undefined ? undefined : watchedFraction(found)
          }}
          resumeFor={resumeFor}
          isKept={favourites.isKept}
          onToggleKept={(media) => {
            favourites.toggle(media.id)
          }}
        />
      ) : (
        <LibraryBrowser
          search={place.search}
          onPlay={(media) => {
            go({ inspecting: media.id })
          }}
          onWatch={(media, startSeconds) => {
            go({ playing: media.id, startSeconds })
          }}
          onItemsLoaded={rememberItems}
          // The only section left that draws the library is home, and home
          // opens with a hero. Searching has a page of its own now.
          hasHero
          onFeatureChange={setFeatured}
          onPalette={setMoodLights}
          isKept={favourites.isKept}
          onToggleKept={(media) => {
            favourites.toggle(media.id)
          }}
        />
      )}
    </AppShell>
  )
}

App.displayName = 'App'

export default { App }
