import { useCallback, useEffect, useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import SpinnerModule from '@FluxUI/Spinner'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import SignInModule from '@FluxWeb/components/SignIn/SignIn'
import TwoFactorSetupModule from '@FluxWeb/components/TwoFactorSetup/TwoFactorSetup'
import PasskeySetupModule from '@FluxWeb/components/PasskeySetup/PasskeySetup'
import fetchSessionModule from '@FluxWeb/session/fetchSession'
import signOutModule from '@FluxWeb/session/signOut'
import SetupModule from '@FluxContracts/schemas/Setup'
import type { SetupStatus } from '@FluxContracts/schemas/Setup'
import type { SessionUser } from '@FluxContracts/schemas/Session'
import type { AppProps } from './App.types'

const { Button } = ButtonModule
const { Spinner } = SpinnerModule
const { SetupWizard } = SetupWizardModule
const { SignIn } = SignInModule
const { TwoFactorSetup } = TwoFactorSetupModule
const { PasskeySetup } = PasskeySetupModule
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
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text">{initialTitle}</h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOut().then(() => refresh())
          }}
        >
          Sign out
        </Button>
      </header>

      <p className="text-text-muted">Signed in as {user.email}. The library lands here next.</p>

      <TwoFactorSetup
        isEnabled={user.twoFactorEnabled === true}
        onChanged={() => {
          void refresh()
        }}
      />

      <PasskeySetup />
    </main>
  )
}

App.displayName = 'App'

export default { App }
