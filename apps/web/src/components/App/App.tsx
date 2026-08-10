import { useCallback, useEffect, useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import SpinnerModule from '@FluxUI/Spinner'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import SignInModule from '@FluxWeb/components/SignIn/SignIn'
import TwoFactorSetupModule from '@FluxWeb/components/TwoFactorSetup/TwoFactorSetup'
import PasskeySetupModule from '@FluxWeb/components/PasskeySetup/PasskeySetup'
import LibraryBrowserModule from '@FluxWeb/components/LibraryBrowser/LibraryBrowser'
import VideoPlayerModule from '@FluxWeb/components/VideoPlayer/VideoPlayer'
import fetchSessionModule from '@FluxWeb/session/fetchSession'
import signOutModule from '@FluxWeb/session/signOut'
import SetupModule from '@FluxContracts/schemas/Setup'
import type { SetupStatus } from '@FluxContracts/schemas/Setup'
import type { SessionUser } from '@FluxContracts/schemas/Session'
import type { MediaSummary } from '@FluxContracts/schemas/Library'
import type { AppProps } from './App.types'

const { Button } = ButtonModule
const { Spinner } = SpinnerModule
const { SetupWizard } = SetupWizardModule
const { SignIn } = SignInModule
const { TwoFactorSetup } = TwoFactorSetupModule
const { PasskeySetup } = PasskeySetupModule
const { LibraryBrowser } = LibraryBrowserModule
const { VideoPlayer } = VideoPlayerModule
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
  const [nowPlaying, setNowPlaying] = useState<MediaSummary | null>(null)
  const [showSettings, setShowSettings] = useState(false)

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

  if (loadState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading Flux" size="lg" />
      </main>
    )
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
          void refresh()
        }}
      />
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text">{initialTitle}</h1>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-text-muted sm:inline">{user.email}</span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSettings((shown) => !shown)
            }}
          >
            {showSettings ? 'Back to library' : 'Security'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void signOut().then(() => refresh())
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      {nowPlaying === null ? null : (
        <VideoPlayer
          media={nowPlaying}
          onClose={() => {
            setNowPlaying(null)
          }}
        />
      )}

      {showSettings ? (
        <div className="flex flex-col gap-4">
          <TwoFactorSetup
            isEnabled={user.twoFactorEnabled === true}
            onChanged={() => {
              void refresh()
            }}
          />

          <PasskeySetup />
        </div>
      ) : (
        <LibraryBrowser onPlay={setNowPlaying} />
      )}
    </main>
  )
}

App.displayName = 'App'

export default { App }
