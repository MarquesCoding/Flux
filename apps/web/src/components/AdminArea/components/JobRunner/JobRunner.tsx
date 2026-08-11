import { useState } from 'react'
import {
  IconBolt,
  IconLayoutGrid,
  IconPhoto,
  IconRefresh,
  IconScissors,
  IconTrash,
} from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import DialogModule from '@FluxUI/Dialog'
import ScanProgressBarModule from '@FluxWeb/components/AdminArea/components/ScanProgressBar/ScanProgressBar'
import summariseProgressModule from './summariseProgress'
import type { JobDefinition } from '@FluxWeb/admin/fetchAdmin'
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator'
import type { JobRunnerProps } from './JobRunner.types'

const { Button } = ButtonModule
const { Dialog } = DialogModule
const { ScanProgressBar } = ScanProgressBarModule
const { summariseProgress } = summariseProgressModule

/**
 * What a job kind looks like at a glance.
 *
 * Falls back to a generic icon for a kind this component has never seen —
 * the picker is meant to work for a kind added to the server's registry
 * after this file was last touched, not only the ones it ships with.
 */
const JOB_ICONS: Record<string, typeof IconRefresh> = {
  'library.scan': IconRefresh,
  'library.regeneratePreviews': IconPhoto,
  'library.regenerateTrickplay': IconLayoutGrid,
  'library.detectSegments': IconScissors,
  'library.reset': IconTrash,
}

/**
 * Lets an admin start any job on demand, or press into it to see how often
 * it runs on its own — Jellyfin's scheduled-tasks page style.
 *
 * Reads from the same `scanCoordinator` progress map the Libraries panel's
 * own scan buttons use, so a job started here shows up there too, and a job
 * already running disables its own row rather than letting an operator
 * queue a second one. A job that does not need a library is tracked under
 * its own kind instead — see `scanCoordinator.runDefinedJob`.
 */
const JobRunner = ({ definitions, libraries, progress, onRun, onOpenSchedule }: JobRunnerProps) => {
  const [confirming, setConfirming] = useState<JobDefinition | null>(null)

  /**
   * Everything running under one job kind, folded into the one bar its row
   * shows.
   *
   * A library-scoped job is tracked per library and a server-wide one under
   * its own kind, so both are gathered here — an operator pressing Run once
   * expects one answer about it, not a bar for every library it happened to
   * fan out across.
   */
  const summaryFor = (kind: string) =>
    summariseProgress(
      [...libraries.map((library) => progress.get(library.id)), progress.get(kind)].filter(
        (entry): entry is ScanEntry => entry?.kind === kind,
      ),
    )

  const libraryDefinitions = definitions.filter((definition) => definition.needsLibrary)
  const serverDefinitions = definitions.filter((definition) => !definition.needsLibrary)

  const askOrRun = (definition: JobDefinition) => {
    if (definition.destructive) {
      setConfirming(definition)
    } else {
      onRun(definition.kind)
    }
  }

  const row = (definition: JobDefinition) => {
    const Icon = JOB_ICONS[definition.kind] ?? IconBolt
    const summary = summaryFor(definition.kind)

    return (
      <li
        key={definition.kind}
        className="flex flex-wrap items-center justify-between gap-3 py-1 first:pt-0 last:pb-0"
      >
        <Button
          variant="ghost"
          className="min-w-0 flex-1 justify-start gap-3 rounded-lg px-2 py-2 text-left"
          aria-label={`View schedule for ${definition.label}`}
          onClick={() => {
            onOpenSchedule(definition.kind)
          }}
        >
          <Icon size={18} className="mt-0.5 shrink-0 self-start text-text-muted" aria-hidden />

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm text-text">{definition.label}</span>
            <span className="text-xs text-text-muted">{definition.description}</span>
          </div>
        </Button>

        {summary === null ? (
          <Button
            variant="ghost"
            size="sm"
            isPill
            aria-label={`Run ${definition.label}`}
            onClick={() => {
              askOrRun(definition)
            }}
          >
            Run
          </Button>
        ) : (
          <ScanProgressBar
            label={definition.label}
            phase={summary.phase}
            processed={summary.processed}
            total={summary.total}
          />
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <ul className="flex flex-col divide-y divide-white/5">
        {libraryDefinitions.map((definition) => row(definition))}
      </ul>

      {serverDefinitions.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
          <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">Server-wide</h3>

          <ul className="flex flex-col divide-y divide-white/5">
            {serverDefinitions.map((definition) => row(definition))}
          </ul>
        </div>
      )}

      <Dialog
        label={confirming === null ? 'Run this job?' : `Run ${confirming.label}?`}
        isOpen={confirming !== null}
        onClose={() => {
          setConfirming(null)
        }}
      >
        {confirming === null ? null : (
          <div className="flex flex-col gap-5 p-6">
            <h2 className="text-lg font-medium text-text">{confirming.label}?</h2>

            <p className="text-sm text-text-muted">
              {confirming.description} This cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                isPill
                onClick={() => {
                  setConfirming(null)
                }}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                isPill
                onClick={() => {
                  onRun(confirming.kind)
                  setConfirming(null)
                }}
              >
                {confirming.label}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

JobRunner.displayName = 'JobRunner'

export default { JobRunner }
