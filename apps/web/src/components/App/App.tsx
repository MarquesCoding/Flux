import { useCallback, useEffect, useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import SignInModule from '@FluxWeb/components/SignIn/SignIn'
import TwoFactorSetupModule from '@FluxWeb/components/TwoFactorSetup/TwoFactorSetup'
import PasskeySetupModule from '@FluxWeb/components/PasskeySetup/PasskeySetup'
import LibraryBrowserModule from '@FluxWeb/components/LibraryBrowser/LibraryBrowser'
import VideoPlayerModule from '@FluxWeb/components/VideoPlayer/VideoPlayer'
import MediaDetailDialogModule from '@FluxWeb/components/MediaDetailDialog/MediaDetailDialog'
import AppShellModule from '@FluxWeb/components/AppShell/AppShell'
import SplashScreenModule from '@FluxUI/SplashScreen'
import AdminAreaModule from '@FluxWeb/components/AdminArea/AdminArea'
import ProfilePickerModule from '@FluxWeb/components/ProfilePicker/ProfilePicker'
import fetchProfilesModule from '@FluxWeb/profiles/fetchProfiles'
import currentProfileModule from '@FluxWeb/profiles/currentProfile'
import watchProgressModule from '@FluxWeb/playback/watchProgress'
import WatchProgressContract from '@FluxContracts/schemas/WatchProgress'
import type { ShellSection } from '@FluxWeb/components/AppShell/AppShell.types'
import fetchSessionModule from '@FluxWeb/session/fetchSession'
import signOutModule from '@FluxWeb/session/signOut'
import SetupModule from '@FluxContracts/schemas/Setup'
import type { SetupStatus } from '@FluxContracts/schemas/Setup'
import type { SessionUser } from '@FluxContracts/schemas/Session'
import type { MediaSummary } from '@FluxContracts/schemas/Library'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'
import type { AppProps } from './App.types'

const { Button } = ButtonModule
const { SetupWizard } = SetupWizardModule
const { SignIn } = SignInModule
const { TwoFactorSetup } = TwoFactorSetupModule
const { PasskeySetup } = PasskeySetupModule
const { LibraryBrowser } = LibraryBrowserModule
const { VideoPlayer } = VideoPlayerModule
const { MediaDetailDialog } = MediaDetailDialogModule
const { AppShell } = AppShellModule
const { SplashScreen } = SplashScreenModule
const { AdminArea } = AdminAreaModule
const { ProfilePicker } = ProfilePickerModule
const { fetchProfiles } = fetchProfilesModule
const { readCurrentProfile, writeCurrentProfile } = currentProfileModule
const { fetchWatchProgress, byMediaId } = watchProgressModule
const { isWorthResuming } = WatchProgressContract

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
  const [nowPlaying, setNowPlaying] = useState<{
    media: MediaSummary
    startSeconds: number
  } | null>(null)
  const [progress, setProgress] = useState(new Map<string, WatchProgress>())
  const [inspecting, setInspecting] = useState<MediaSummary | null>(null)
  const [section, setSection] = useState<ShellSection>('home')
  const [search, setSearch] = useState('')
  const [featured, setFeatured] = useState<MediaSummary | null>(null)
  const [isTitleOver, setIsTitleOver] = useState(false)
  const [profiles, setProfiles] = useState<ViewerProfile[] | null>(null)
  const [watchingId, setWatchingId] = useState<string | null>(readCurrentProfile())

  const readProfiles = useCallback(async () => {
    setProfiles(await fetchProfiles())
  }, [])

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

  const readProgress = useCallback(async () => {
    setProgress(byMediaId(await fetchWatchProgress()))
  }, [])

  const forget = useCallback(() => {
    writeCurrentProfile(null)
    setWatchingId(null)
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
      void readProfiles()
      void readProgress()
    }
  }, [user, readProfiles, readProgress])

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
      <SignIn
        onSignedIn={() => {
          // Signing in is a new session, so who is watching is asked again.
          // The choice is remembered for reloads, not for whoever signs in
          // next on the same machine.
          forget()
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

  // Between signing in and the library: who is watching. Asked once per device
  // and remembered, because a household shares an account and does not share a
  // continue watching row.
  if (profiles === null) {
    return <SplashScreen name={initialTitle} label="Loading profiles" />
  }

  if (watchingId === null || !profiles.some((profile) => profile.id === watchingId)) {
    return (
      <ProfilePicker
        profiles={profiles}
        onChoose={(profile) => {
          writeCurrentProfile(profile.id)
          setWatchingId(profile.id)
        }}
        onChanged={() => {
          void readProfiles()
        }}
        isEditable
      />
    )
  }

  // Watching is not a thing that happens inside a library page. The player
  // takes the whole viewport so nothing else competes with it, and escape or
  // closing puts the library back exactly where it was.
  if (nowPlaying !== null) {
    return (
      <main className="fixed inset-0 z-40 flex flex-col bg-black">
        <VideoPlayer
          media={nowPlaying.media}
          startSeconds={nowPlaying.startSeconds}
          isImmersive
          onClose={() => {
            // Back to where they came from, not out to the library: someone
            // leaving a film usually wants the page about it, whether to read
            // the rest of it or to pick the next episode.
            setInspecting(nowPlaying.media)
            setNowPlaying(null)
          }}
        />
      </main>
    )
  }

  return (
    <AppShell
      section={section}
      onSectionChange={(next) => {
        // Leaving search abandons the search. Carrying the term out with them
        // leaves home showing a filtered library and no hero, which reads as
        // the page having broken.
        if (next !== 'search') {
          setSearch('')
        }

        setSection(next)
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
        {...(inspecting !== null && resumeFor(inspecting.id) !== null
          ? { resumeSeconds: resumeFor(inspecting.id) ?? 0 }
          : {})}
        onClose={() => {
          setInspecting(null)
        }}
        onPlay={(media, startSeconds) => {
          setInspecting(null)
          setNowPlaying({ media, startSeconds })
        }}
      />

      {section === 'admin' ? (
        <AdminArea />
      ) : section === 'account' ? (
        <div className="flex flex-col gap-4 p-5 pt-12 sm:p-10">
          <header className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">{initialTitle}</h1>

            <Button
              variant="secondary"
              size="sm"
              isPill
              onClick={() => {
                forget()
                void signOut().then(() => refresh())
              }}
            >
              Sign out
            </Button>
          </header>

          <p className="text-sm text-text-muted">{user.email}</p>

          <TwoFactorSetup
            isEnabled={user.twoFactorEnabled === true}
            onChanged={() => {
              void refresh()
            }}
          />

          <PasskeySetup />
        </div>
      ) : (
        <LibraryBrowser
          search={search}
          onPlay={setInspecting}
          // Only the home section opens with a hero. Films and series are
          // places someone arrived at looking for something, and a screen of
          // artwork between them and the list is in the way.
          hasHero={section === 'home' && search === ''}
          isSearching={section === 'search'}
          onSearchChange={setSearch}
          onFeatureChange={setFeatured}
        />
      )}
    </AppShell>
  )
}

App.displayName = 'App'

export default { App }
