import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import JobRunnerModule from './JobRunner'
import type { Library } from '@FluxContracts/schemas/Library'
import type { JobDefinition } from '@FluxWeb/admin/fetchAdmin'
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator'

const { JobRunner } = JobRunnerModule

const DEFINITIONS: JobDefinition[] = [
  {
    kind: 'library.scan',
    label: 'Scan for changes',
    description: 'Finds new, changed and removed files.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.regeneratePreviews',
    label: 'Generate missing previews',
    description: 'Renders preview clips for items that have none.',
    needsLibrary: true,
    destructive: false,
  },
  {
    kind: 'library.reset',
    label: 'Reset and rebuild',
    description: 'Deletes everything in every library, then scans it from nothing.',
    needsLibrary: true,
    destructive: true,
  },
]

const MOVIES: Library = {
  id: 'lib-movies',
  name: 'Movies',
  kind: 'movies',
  path: '/media/movies',
  itemCount: 10,
  lastScannedAt: null,
  defaultAudioLanguage: null,
}

describe('JobRunner', () => {
  it('lists every job an admin can start', () => {
    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(screen.getByText('Scan for changes')).toBeInTheDocument()
    expect(
      screen.getByText('Deletes everything in every library, then scans it from nothing.'),
    ).toBeInTheDocument()
  })

  it('runs a non-destructive job the moment Run is pressed', async () => {
    const onRun = vi.fn()
    const user = userEvent.setup()

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={onRun}
        onOpenSchedule={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Run Scan for changes' }))

    expect(onRun).toHaveBeenCalledWith('library.scan')
  })

  it('opens the schedule page when a row is pressed anywhere but Run', async () => {
    const onOpenSchedule = vi.fn()
    const user = userEvent.setup()

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={vi.fn()}
        onOpenSchedule={onOpenSchedule}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View schedule for Scan for changes' }))

    expect(onOpenSchedule).toHaveBeenCalledWith('library.scan')
  })

  it('asks before running a destructive job, rather than running it immediately', async () => {
    const onRun = vi.fn()
    const user = userEvent.setup()

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={onRun}
        onOpenSchedule={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Run Reset and rebuild' }))

    expect(onRun).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Reset and rebuild?' })).toBeInTheDocument()
  })

  it('runs a destructive job once confirmed', async () => {
    const onRun = vi.fn()
    const user = userEvent.setup()

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={onRun}
        onOpenSchedule={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Run Reset and rebuild' }))
    await user.click(screen.getByRole('button', { name: 'Reset and rebuild' }))

    expect(onRun).toHaveBeenCalledWith('library.reset')
  })

  it('leaves a destructive job untouched when the confirmation is cancelled', async () => {
    const onRun = vi.fn()
    const user = userEvent.setup()

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={onRun}
        onOpenSchedule={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Run Reset and rebuild' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onRun).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Reset and rebuild?' })).not.toBeInTheDocument()
  })

  it('replaces the Run button with progress while a job is running', () => {
    const progress = new Map<string, ScanEntry>([
      ['lib-movies', { kind: 'library.scan', phase: 'probing', processed: 1, total: 4 }],
    ])

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={progress}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Run Scan for changes' })).toBeNull()
    expect(
      screen.getByRole('progressbar', { name: 'Scan for changes: Probing' }),
    ).toBeInTheDocument()
  })

  it('shows one bar for a job running across several libraries, not one each', () => {
    const shows = { ...MOVIES, id: 'lib-shows', name: 'Shows' }
    const progress = new Map<string, ScanEntry>([
      ['lib-movies', { kind: 'library.scan', phase: 'previews', processed: 1, total: 4 }],
      ['lib-shows', { kind: 'library.scan', phase: 'previews', processed: 2, total: 6 }],
    ])

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES, shows]}
        progress={progress}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    const bars = screen.getAllByRole('progressbar')

    expect(bars).toHaveLength(1)
    expect(bars[0]).toHaveAttribute('aria-valuenow', '3')
    expect(bars[0]).toHaveAttribute('aria-valuemax', '10')
  })

  it('leaves every other row runnable while one job is going', () => {
    const progress = new Map<string, ScanEntry>([
      ['lib-movies', { kind: 'library.scan', phase: 'probing', processed: 1, total: 4 }],
    ])

    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={progress}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Run Generate missing previews' }),
    ).toBeInTheDocument()
  })

  it('separates a job that is not library-scoped from the library jobs', async () => {
    const onRun = vi.fn()
    const user = userEvent.setup()
    const definitions: JobDefinition[] = [
      ...DEFINITIONS,
      {
        kind: 'catalogue.rematch',
        label: 'Re-match against the catalogue',
        description: 'Retries metadata matching for every item on the server.',
        needsLibrary: false,
        destructive: false,
      },
    ]

    render(
      <JobRunner
        definitions={definitions}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={onRun}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(screen.getByText('Server-wide')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run Re-match against the catalogue' }))

    expect(onRun).toHaveBeenCalledWith('catalogue.rematch')
  })

  it('replaces Run with progress for a server-wide job, tracked under its own kind', () => {
    const definitions: JobDefinition[] = [
      ...DEFINITIONS,
      {
        kind: 'catalogue.rematch',
        label: 'Re-match against the catalogue',
        description: 'Retries metadata matching for every item on the server.',
        needsLibrary: false,
        destructive: false,
      },
    ]
    const progress = new Map<string, ScanEntry>([
      ['catalogue.rematch', { kind: 'catalogue.rematch', phase: null, processed: 3, total: 10 }],
    ])

    render(
      <JobRunner
        definitions={definitions}
        libraries={[MOVIES]}
        progress={progress}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Run Re-match against the catalogue' })).toBeNull()
    expect(
      screen.getByRole('progressbar', { name: 'Re-match against the catalogue' }),
    ).toBeInTheDocument()
  })

  it('has no server-wide section when every job needs a library', () => {
    render(
      <JobRunner
        definitions={DEFINITIONS}
        libraries={[MOVIES]}
        progress={new Map()}
        onRun={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    )

    expect(screen.queryByText('Server-wide')).not.toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(JobRunner.displayName).toBe('JobRunner')
  })
})
