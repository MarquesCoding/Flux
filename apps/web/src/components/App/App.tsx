import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import LibraryBrowserModule from '@FluxWeb/components/LibraryBrowser/LibraryBrowser'
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

/**
 * How long the opening title stays up.
 */
const SPLASH_MILLISECONDS = 8_000
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
  const [featured, setFeatured] = useState<MediaSummary | null>(null)
  const [isTitleOver, setIsTitleOver] = useState(false)
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

  // The opening title is held for its own length rather than for however long
  // the server happens to take. A title card that flashes for 200ms on a fast
  // connection and lingers on a slow one is not a title card.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTitleOver(true)
    }, SPLASH_MILLISECONDS)

    return () => {
      clearTimeout(timer)
    }
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

  // The opening title belongs in front of the library, not in front of the
  // sign-in form. Somebody being asked for a password is not arriving
  // anywhere yet, and holding them behind a title card is eight seconds
  // between them and a field they have to fill in.
  if (!isTitleOver) {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />
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
      // Home and search draw the same library, so moving between them keeps
      // the page rather than fetching it all over again.
      viewKey={section === 'home' || section === 'search' ? 'library' : section}
      // The page takes its colour from whatever the viewer is looking at:
      // what they have opened, or failing that what the hero is showing.
      moodColor={inspecting?.accentColor ?? featured?.accentColor ?? null}
      isAdministrator={user.role === 'admin'}
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
          // Only the home section opens with a hero. Films and series are
          // places someone arrived at looking for something, and a screen of
          // artwork between them and the list is in the way.
          hasHero={section === 'home' && place.search === ''}
          isSearching={section === 'search'}
          onSearchChange={(next) => {
            // Replaced rather than pushed: a search box would otherwise fill
            // the history with one entry per letter typed.
            replace({ search: next })
          }}
          onFeatureChange={setFeatured}
        />
      )}
    </AppShell>
  )
}

App.displayName = 'App'

export default { App }
