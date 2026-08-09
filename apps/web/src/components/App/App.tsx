import { useCallback, useEffect, useState } from 'react'
import SpinnerModule from '@FluxUI/Spinner'
import SetupWizardModule from '@FluxWeb/components/SetupWizard/SetupWizard'
import SetupModule from '@FluxContracts/schemas/Setup'
import type { SetupStatus } from '@FluxContracts/schemas/Setup'
import type { AppProps } from './App.types'

const { Spinner } = SpinnerModule
const { SetupWizard } = SetupWizardModule
const { SetupStatusSchema } = SetupModule

type LoadState = 'loading' | 'ready' | 'unreachable'

/**
 * Application shell.
 *
 * Decides between first-run setup and the library on the server's answer
 * rather than on local state, so a second browser cannot skip setup.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/setup/status')

      if (!response.ok) {
        setLoadState('unreachable')

        return
      }

      setStatus(SetupStatusSchema.parse(await response.json()))
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

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-text">{initialTitle}</h1>
      <p className="text-text-muted">Setup is complete. The library lands here next.</p>
    </main>
  )
}

App.displayName = 'App'

export default { App }
