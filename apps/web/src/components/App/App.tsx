import { useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import CheckboxModule from '@FluxUI/Checkbox'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import type { AppProps } from './App.types'

const { Button } = ButtonModule
const { Checkbox } = CheckboxModule
const { formatDuration } = formatDurationModule

const SAMPLE_DURATION_SECONDS = 7325

/**
 * Placeholder application shell. Exists so the scaffold proves the stack end
 * to end: aliased imports, FluxUI components, and a shared core function.
 */
const App = ({ initialTitle = 'Flux' }: AppProps) => {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-text">{initialTitle}</h1>

      <p className="text-text-muted">Sample runtime {formatDuration(SAMPLE_DURATION_SECONDS)}</p>

      <Checkbox label="Burn in subtitles" />

      <div className="flex gap-3">
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
          }}
        >
          Play
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            setIsLoading(false)
          }}
        >
          Reset
        </Button>
      </div>
    </main>
  )
}

App.displayName = 'App'

export default { App }
