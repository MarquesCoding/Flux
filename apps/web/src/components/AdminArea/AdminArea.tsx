import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  IconActivity,
  IconAlertTriangle,
  IconCircleCheck,
  IconCpu,
  IconDatabase,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconRefreshAlert,
  IconStack2,
} from '@tabler/icons-react'
import SparklineModule from '@FluxUI/Sparkline'
import BadgeModule from '@FluxUI/Badge'
import ButtonModule from '@FluxUI/Button'
import TabBarModule from '@FluxUI/TabBar'
import TextFieldModule from '@FluxUI/TextField'
import revealModule from '@FluxUI/animations/reveal'
import fetchAdminModule from '@FluxWeb/admin/fetchAdmin'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import waitForScanCompletionModule from '@FluxWeb/library/waitForScanCompletion'
import StatStripModule from './components/StatStrip/StatStrip'
import AddLibraryDialogModule from './components/AddLibraryDialog/AddLibraryDialog'
import ScanProgressBarModule from './components/ScanProgressBar/ScanProgressBar'
import formatBytesModule from './formatBytes'
import type { Library } from '@FluxContracts/schemas/Library'
import type { AdminOverview, Job, Monitor } from '@FluxWeb/admin/fetchAdmin'
import type { AdminAreaProps } from './AdminArea.types'

const { Sparkline } = SparklineModule
const { Badge } = BadgeModule
const { Button } = ButtonModule
const { TabBar } = TabBarModule
const { TextField } = TextFieldModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { fetchAdminOverview, fetchMonitor, watchMonitor, saveCatalogueKey } = fetchAdminModule
const { fetchLibraries, scanLibrary } = fetchLibraryModule
const { waitForScanCompletion } = waitForScanCompletionModule
const { StatStrip } = StatStripModule
const { AddLibraryDialog } = AddLibraryDialogModule
const { ScanProgressBar } = ScanProgressBarModule
const { formatBytes } = formatBytesModule

/**
 * How many readings stay on screen.
 */
const HISTORY_LENGTH = 60

const PANELS = [
  { id: 'activity', label: 'Activity' },
  { id: 'work', label: 'Work' },
  { id: 'events', label: 'Events' },
  { id: 'libraries', label: 'Libraries' },
  { id: 'settings', label: 'Settings' },
] as const

type PanelId = (typeof PANELS)[number]['id']

const JOB_TONES: Record<Job['state'], 'quiet' | 'accent' | 'solid'> = {
  queued: 'quiet',
  running: 'accent',
  finished: 'quiet',
  failed: 'solid',
}

/**
 * How long a job took, or has been taking.
 */
const describeElapsed = (job: Job, now: number): string => {
  if (job.startedAtMs === null) {
    return 'waiting'
  }

  const elapsed = (job.finishedAtMs ?? now) - job.startedAtMs

  return elapsed < 1000
    ? `${elapsed.toString()} ms`
    : `${(elapsed / 1000).toFixed(elapsed < 10_000 ? 1 : 0)} s`
}

const atTime = (ms: number): string => new Date(ms).toLocaleTimeString()

/**
 * Trims what ffmpeg calls itself down to a version.
 *
 * Its own answer is a sentence with a copyright notice in it, which is not how
 * a line reading "Media service up" should end.
 */
const shortVersion = (reported: string | null): string => {
  if (reported === null) {
    return 'unknown'
  }

  return /ffmpeg version (\S+)/.exec(reported)?.[1] ?? reported.slice(0, 24)
}

/**
 * The server, as the person running it sees it.
 *
 * Laid out as an instrument rather than as a page of cards: the figures that
 * matter sit in one strip across the top and stay there, and what changes
 * underneath is a panel the strip is context for. Somebody watching a
 * conversion start should not have to choose between seeing the queue and
 * seeing what it costs.
 *
 * Readings arrive over an event stream and a minute of them is kept, because
 * one number says nothing about whether it is climbing.
 */
const AdminArea = ({ historyLength = HISTORY_LENGTH }: AdminAreaProps) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [panel, setPanel] = useState<PanelId>('activity')
  const [catalogueKey, setCatalogueKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [isAddingLibrary, setIsAddingLibrary] = useState(false)
  const [scanProgress, setScanProgress] = useState<
    ReadonlyMap<string, { phase: string | null; processed: number | null; total: number | null }>
  >(new Map())
  const [isScanningAll, setIsScanningAll] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const onLibraryCreated = (library: Library) => {
    setLibraries((current) => [...current, library])
    setIsAddingLibrary(false)
  }

  const trackProgress = (
    libraryId: string,
    phase: string | null,
    processed: number | null,
    total: number | null,
  ) => {
    setScanProgress((current) => new Map(current).set(libraryId, { phase, processed, total }))
  }

  const untrackProgress = (libraryId: string) => {
    setScanProgress((current) => {
      const next = new Map(current)
      next.delete(libraryId)

      return next
    })
  }

  const rescan = async (libraryId: string) => {
    trackProgress(libraryId, null, null, null)

    try {
      const job = await scanLibrary(libraryId)

      if (job !== null) {
        await waitForScanCompletion(job.jobId, (progress) => {
          trackProgress(libraryId, progress.phase, progress.processed, progress.total)
        })
      }

      setLibraries(await fetchLibraries())
    } finally {
      untrackProgress(libraryId)
    }
  }

  const rescanAll = async () => {
    setIsScanningAll(true)

    for (const library of libraries) {
      trackProgress(library.id, null, null, null)
    }

    try {
      await Promise.all(
        libraries.map(async (library) => {
          const job = await scanLibrary(library.id, true)

          if (job !== null) {
            await waitForScanCompletion(job.jobId, (progress) => {
              trackProgress(library.id, progress.phase, progress.processed, progress.total)
            })
          }

          untrackProgress(library.id)
        }),
      )

      setLibraries(await fetchLibraries())
    } finally {
      setIsScanningAll(false)
      setScanProgress(new Map())
    }
  }

  useEffect(() => {
    void fetchAdminOverview().then(setOverview)
    void fetchMonitor().then(setMonitor)
    void fetchLibraries().then(setLibraries)
  }, [])

  useEffect(() => {
    const stop = watchMonitor((reading) => {
      setMonitor(reading)
      setHistory((current) =>
        [...current, reading.resources.systemCpuPercent].slice(-historyLength),
      )
    })

    return stop
  }, [historyLength])

  const now = Date.now()
  const resources = monitor?.resources ?? null
  const memoryFraction =
    resources === null || resources.systemMemoryTotalBytes === 0
      ? 0
      : resources.systemMemoryUsedBytes / resources.systemMemoryTotalBytes

  const failures = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'failed').length
  const conversions = resources?.children ?? []

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-16 pt-14 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">Server</h1>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              {overview?.transcoder.isReachable === true ? (
                <IconCircleCheck size={16} className="text-accent" aria-hidden />
              ) : (
                <IconAlertTriangle size={16} className="text-danger" aria-hidden />
              )}
              {overview === null
                ? 'Reading the server…'
                : overview.transcoder.isReachable
                  ? `Media service up · ffmpeg ${shortVersion(overview.transcoder.ffmpegVersion)}`
                  : 'Media service unreachable'}
            </span>

            {(overview?.transcoder.hardwareAccels ?? []).map((accel) => (
              <Badge key={accel} size="sm">
                {accel}
              </Badge>
            ))}
          </p>
        </div>

        <TabBar
          tabs={[...PANELS]}
          selectedId={panel}
          onSelect={(id) => {
            // Matched against the same list the bar was given rather than
            // trusted: anything else is not a panel this page has.
            const found = PANELS.find((candidate) => candidate.id === id)

            if (found !== undefined) {
              setPanel(found.id)
            }
          }}
          label="What to look at"
        />
      </motion.header>

      <motion.div
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
      >
        <StatStrip
          stats={[
            {
              label: 'Processor',
              icon: <IconCpu size={14} aria-hidden />,
              value: `${(resources?.systemCpuPercent ?? 0).toFixed(0)}%`,
              fraction: (resources?.systemCpuPercent ?? 0) / 100,
              detail:
                resources === null
                  ? '—'
                  : `${resources.cpuCount.toString()} cores · load ${resources.loadAverage.toFixed(2)}`,
            },
            {
              label: 'Memory',
              icon: <IconDatabase size={14} aria-hidden />,
              value: resources === null ? '—' : formatBytes(resources.systemMemoryUsedBytes),
              fraction: memoryFraction,
              detail:
                resources === null
                  ? '—'
                  : `of ${formatBytes(resources.systemMemoryTotalBytes)} · service ${formatBytes(resources.serviceMemoryBytes)}`,
            },
            {
              label: 'Streaming',
              icon: <IconPlayerPlay size={14} aria-hidden />,
              value: (monitor?.sessions ?? 0).toString(),
              detail: `${conversions.length.toString()} conversions running`,
            },
            {
              label: 'Library',
              icon: <IconStack2 size={14} aria-hidden />,
              value: (overview?.library.itemCount ?? 0).toString(),
              detail:
                overview === null
                  ? '—'
                  : `${overview.library.libraryCount.toString()} ${
                      overview.library.libraryCount === 1 ? 'library' : 'libraries'
                    } · ${overview.users.length.toString()} accounts`,
            },
          ]}
        />
      </motion.div>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label={PANELS.find((candidate) => candidate.id === panel)?.label ?? 'Activity'}
        className="min-h-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={panel}
            initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion === true ? 0 : -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {panel === 'activity' ? (
              <div className="grid gap-px bg-white/10 lg:grid-cols-[1.4fr_1fr]">
                <div className="flex flex-col gap-4 bg-surface/40 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
                      <IconActivity size={14} aria-hidden />
                      Last minute
                    </h2>

                    <span className="text-xs tabular-nums text-text-muted">
                      {history.length.toString()} readings
                    </span>
                  </div>

                  <Sparkline
                    values={history}
                    ceiling={100}
                    label="Processor use over the last minute"
                    className="h-32"
                  />

                  <p className="text-xs leading-relaxed text-text-muted">
                    A reading a second. A tall run is something being converted; a flat floor is the
                    server idling.
                  </p>
                </div>

                <div className="flex flex-col gap-3 bg-surface/40 p-5">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                    Conversions
                  </h2>

                  {conversions.length === 0 ? (
                    <p className="text-sm text-text-muted">Nothing is being converted.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {conversions.map((child) => (
                        <li key={child.pid} className="flex flex-col gap-1.5">
                          <span className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                            <span className="text-text">ffmpeg {child.pid}</span>
                            <span className="text-text-muted">
                              {child.cpuPercent.toFixed(0)}% · {formatBytes(child.memoryBytes)}
                            </span>
                          </span>

                          {/* Measured against every core rather than one, so a
                              process reported at 380% reads as what it is: a
                              fair share of an eighteen core machine. */}
                          <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              role="presentation"
                              style={{
                                width: `${Math.min(
                                  (child.cpuPercent /
                                    Math.max((resources?.cpuCount ?? 1) * 100, 1)) *
                                    100,
                                  100,
                                ).toString()}%`,
                              }}
                              className="block h-full rounded-full bg-accent"
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            {panel === 'work' ? (
              <div className="flex flex-col">
                <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 px-5 py-3">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                    Background work
                  </h2>

                  <span className="text-xs text-text-muted">
                    {monitor === null
                      ? '—'
                      : `${monitor.queue.running.toString()} running · ${monitor.queue.queued.toString()} waiting · ${monitor.queue.concurrency.toString()} at a time${
                          failures === 0 ? '' : ` · ${failures.toString()} failed`
                        }`}
                  </span>
                </header>

                {monitor === null || monitor.queue.jobs.length === 0 ? (
                  <p className="p-5 text-sm text-text-muted">Nothing queued.</p>
                ) : (
                  <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                    {monitor.queue.jobs.map((job) => (
                      <li key={job.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                        <Badge size="sm" tone={JOB_TONES[job.state]}>
                          {job.state}
                        </Badge>

                        <span className="w-24 shrink-0 text-text-muted">{job.kind}</span>

                        <span className="min-w-0 flex-1 truncate text-text" title={job.subject}>
                          {job.subject}
                        </span>

                        {job.detail === null ? null : (
                          <span className="hidden max-w-64 truncate text-xs text-danger sm:block">
                            {job.detail}
                          </span>
                        )}

                        <span className="shrink-0 tabular-nums text-text-muted">
                          {describeElapsed(job, now)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {panel === 'events' ? (
              <div className="flex flex-col">
                <header className="border-b border-white/10 px-5 py-3">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                    Recent events
                  </h2>
                </header>

                {monitor === null || monitor.logs.length === 0 ? (
                  <p className="p-5 text-sm text-text-muted">Nothing has been reported.</p>
                ) : (
                  <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto font-mono text-xs">
                    {monitor.logs.map((line) => (
                      <li
                        key={`${line.atMs.toString()}-${line.message}`}
                        className="flex gap-3 px-5 py-2"
                      >
                        <span className="shrink-0 tabular-nums text-text-muted">
                          {atTime(line.atMs)}
                        </span>

                        <span
                          className={`shrink-0 ${
                            line.level === 'error' ? 'text-danger' : 'text-text-muted'
                          }`}
                        >
                          {line.source}
                        </span>

                        <span className="min-w-0 flex-1 text-text">{line.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {panel === 'libraries' ? (
              <div className="flex flex-col">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                    Library roots
                  </h2>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      isPill
                      isLoading={isScanningAll}
                      disabled={libraries.length === 0 || scanProgress.size > 0}
                      onClick={() => {
                        void rescanAll()
                      }}
                    >
                      <IconRefreshAlert size={16} aria-hidden />
                      Scan all libraries
                    </Button>

                    <Button
                      variant="glossy"
                      size="sm"
                      isPill
                      onClick={() => {
                        setIsAddingLibrary(true)
                      }}
                    >
                      <IconPlus size={16} aria-hidden />
                      Add library
                    </Button>
                  </div>
                </header>

                {libraries.length === 0 ? (
                  <p className="p-5 text-sm text-text-muted">
                    No libraries yet. Add one pointing at a folder of media.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {libraries.map((library) => {
                      const progress = scanProgress.get(library.id)

                      return (
                        <li
                          key={library.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2 text-sm text-text">
                              {library.name}
                              <Badge size="sm">{library.kind}</Badge>
                            </span>

                            <span className="truncate text-xs text-text-muted" title={library.path}>
                              {library.path} ·{' '}
                              {library.itemCount === 1
                                ? '1 item'
                                : `${library.itemCount.toString()} items`}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {progress === undefined ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                isPill
                                onClick={() => {
                                  void rescan(library.id)
                                }}
                              >
                                <IconRefresh size={16} aria-hidden />
                                Scan
                              </Button>
                            ) : (
                              <ScanProgressBar
                                label={`Scanning ${library.name}`}
                                phase={progress.phase}
                                processed={progress.processed}
                                total={progress.total}
                              />
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <AddLibraryDialog
                  isOpen={isAddingLibrary}
                  onClose={() => {
                    setIsAddingLibrary(false)
                  }}
                  onCreated={onLibraryCreated}
                />
              </div>
            ) : null}

            {panel === 'settings' ? (
              <div className="grid gap-px bg-white/10 lg:grid-cols-2">
                <div className="flex flex-col gap-4 bg-surface/40 p-5">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                    Metadata catalogue
                  </h2>

                  <p className="text-sm text-text-muted">
                    {overview?.settings.hasCatalogueKey === true
                      ? 'A key is set. Entering a new one replaces it.'
                      : 'Without a key, titles and years come from filenames alone.'}
                  </p>

                  <TextField
                    label="Catalogue key"
                    type="password"
                    value={catalogueKey}
                    onValueChange={setCatalogueKey}
                    placeholder="Paste a key"
                  />

                  <div>
                    <Button
                      variant="glossy"
                      size="sm"
                      isPill
                      isLoading={isSaving}
                      disabled={catalogueKey === ''}
                      onClick={() => {
                        setIsSaving(true)

                        void saveCatalogueKey(catalogueKey).then(async (saved) => {
                          setIsSaving(false)

                          if (saved) {
                            setCatalogueKey('')
                            setOverview(await fetchAdminOverview())
                          }
                        })
                      }}
                    >
                      Save key
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 bg-surface/40 p-5">
                  <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Accounts</h2>

                  <ul className="flex flex-col divide-y divide-white/5 text-sm">
                    {(overview?.users ?? []).map((account) => (
                      <li key={account.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate text-text">{account.email}</span>

                        {account.role === null ? null : <Badge size="sm">{account.role}</Badge>}
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs leading-relaxed text-text-muted">
                    {overview === null
                      ? ''
                      : `Cookies are ${
                          overview.settings.cookieSecure ? 'secure' : 'not secure'
                        }. Origins allowed to sign in: ${overview.settings.trustedOrigins.join(', ')}.`}
                  </p>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

AdminArea.displayName = 'AdminArea'

export default { AdminArea }
