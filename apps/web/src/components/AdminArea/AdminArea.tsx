import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCpu,
  IconDatabase,
  IconPlayerPlay,
  IconUsers,
} from '@tabler/icons-react'
import GlassPanelModule from '@FluxUI/GlassPanel'
import MeterModule from '@FluxUI/Meter'
import SparklineModule from '@FluxUI/Sparkline'
import BadgeModule from '@FluxUI/Badge'
import ButtonModule from '@FluxUI/Button'
import TextFieldModule from '@FluxUI/TextField'
import revealModule from '@FluxUI/animations/reveal'
import fetchAdminModule from '@FluxWeb/admin/fetchAdmin'
import formatBytesModule from './formatBytes'
import type { AdminOverview, Job, Monitor } from '@FluxWeb/admin/fetchAdmin'
import type { AdminAreaProps } from './AdminArea.types'

const { GlassPanel } = GlassPanelModule
const { Meter } = MeterModule
const { Sparkline } = SparklineModule
const { Badge } = BadgeModule
const { Button } = ButtonModule
const { TextField } = TextFieldModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { fetchAdminOverview, fetchMonitor, watchMonitor, saveCatalogueKey } = fetchAdminModule
const { formatBytes } = formatBytesModule

/**
 * How many readings stay on screen.
 */
const HISTORY_LENGTH = 60

/**
 * How a job's state is coloured.
 */
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

/**
 * The clock time of a moment, to the second.
 */
const atTime = (ms: number): string => new Date(ms).toLocaleTimeString()

/**
 * Everything an operator needs to see, in one place.
 *
 * Built around what the machine is doing rather than around what can be
 * configured, because the question somebody opens this page with is almost
 * always "why is it slow" and almost never "what is my trusted origin". The
 * live reading is at the top and settings are below it.
 *
 * Readings arrive over an event stream and are kept for a minute, so the page
 * shows a shape rather than an instant. One number tells you nothing about
 * whether it is climbing.
 */
const AdminArea = ({ historyLength = HISTORY_LENGTH }: AdminAreaProps) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [catalogueKey, setCatalogueKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    void fetchAdminOverview().then(setOverview)
    void fetchMonitor().then(setMonitor)
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

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="flex flex-col gap-6 px-5 pb-12 pt-14 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-2"
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Server</h1>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          {overview === null ? (
            'Reading the server…'
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                {overview.transcoder.isReachable ? (
                  <IconCircleCheck size={16} className="text-accent" aria-hidden />
                ) : (
                  <IconAlertTriangle size={16} className="text-danger" aria-hidden />
                )}
                {overview.transcoder.isReachable
                  ? 'Media service reachable'
                  : 'Media service unreachable'}
              </span>

              {overview.transcoder.hardwareAccels.map((accel) => (
                <Badge key={accel} size="sm">
                  {accel}
                </Badge>
              ))}
            </>
          )}
        </p>
      </motion.header>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Live"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <GlassPanel className="flex flex-col gap-4 p-5">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <IconCpu size={16} aria-hidden />
            Processor
          </span>

          <Meter
            label="Machine"
            fraction={(resources?.systemCpuPercent ?? 0) / 100}
            value={`${(resources?.systemCpuPercent ?? 0).toFixed(0)}%`}
          />

          <Sparkline values={history} ceiling={100} label="Processor use over the last minute" />

          <p className="text-xs text-text-muted">
            {resources === null
              ? '—'
              : `${resources.cpuCount.toString()} cores · load ${resources.loadAverage.toFixed(2)}`}
          </p>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <IconDatabase size={16} aria-hidden />
            Memory
          </span>

          <Meter
            label="Machine"
            fraction={memoryFraction}
            value={
              resources === null
                ? '—'
                : `${formatBytes(resources.systemMemoryUsedBytes)} of ${formatBytes(resources.systemMemoryTotalBytes)}`
            }
          />

          <p className="text-xs text-text-muted">
            {resources === null
              ? '—'
              : `Media service holding ${formatBytes(resources.serviceMemoryBytes)}`}
          </p>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-5">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <IconPlayerPlay size={16} aria-hidden />
            Playing now
          </span>

          <p className="text-4xl font-semibold tabular-nums">{monitor?.sessions ?? 0}</p>

          <ul className="flex flex-col gap-1 text-xs text-text-muted">
            {(resources?.children ?? []).length === 0 ? (
              <li>Nothing is being converted.</li>
            ) : (
              (resources?.children ?? []).map((child) => (
                <li key={child.pid} className="flex justify-between gap-3 tabular-nums">
                  <span>ffmpeg {child.pid}</span>
                  <span>
                    {child.cpuPercent.toFixed(0)}% · {formatBytes(child.memoryBytes)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-5">
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <IconUsers size={16} aria-hidden />
            Library
          </span>

          <p className="text-4xl font-semibold tabular-nums">{overview?.library.itemCount ?? 0}</p>

          <p className="text-xs text-text-muted">
            {overview === null
              ? '—'
              : `across ${overview.library.libraryCount.toString()} ${
                  overview.library.libraryCount === 1 ? 'library' : 'libraries'
                } · ${overview.users.length.toString()} ${
                  overview.users.length === 1 ? 'account' : 'accounts'
                }`}
          </p>
        </GlassPanel>
      </motion.section>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Background work"
        className="flex flex-col gap-3"
      >
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
            Background work
          </h2>

          <span className="text-xs text-text-muted">
            {monitor === null
              ? '—'
              : `${monitor.queue.running.toString()} running · ${monitor.queue.queued.toString()} waiting · ${monitor.queue.concurrency.toString()} at a time`}
          </span>
        </header>

        <GlassPanel elevation="inset" className="max-h-72 overflow-y-auto">
          {monitor === null || monitor.queue.jobs.length === 0 ? (
            <p className="p-5 text-sm text-text-muted">Nothing queued.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {monitor.queue.jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Badge size="sm" tone={JOB_TONES[job.state]}>
                    {job.state}
                  </Badge>

                  <span className="w-24 shrink-0 text-text-muted">{job.kind}</span>

                  <span className="min-w-0 flex-1 truncate text-text">{job.subject}</span>

                  <span className="shrink-0 tabular-nums text-text-muted">
                    {describeElapsed(job, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </motion.section>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Recent events"
        className="flex flex-col gap-3"
      >
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
          Recent events
        </h2>

        <GlassPanel elevation="inset" className="max-h-64 overflow-y-auto">
          {monitor === null || monitor.logs.length === 0 ? (
            <p className="p-5 text-sm text-text-muted">Nothing has been reported.</p>
          ) : (
            <ul className="divide-y divide-white/5 font-mono text-xs">
              {monitor.logs.map((line) => (
                <li
                  key={`${line.atMs.toString()}-${line.message}`}
                  className="flex gap-3 px-5 py-2"
                >
                  <span className="shrink-0 tabular-nums text-text-muted">{atTime(line.atMs)}</span>
                  <span
                    className={`shrink-0 ${line.level === 'error' ? 'text-danger' : 'text-text-muted'}`}
                  >
                    {line.source}
                  </span>
                  <span className="min-w-0 flex-1 text-text">{line.message}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </motion.section>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Settings"
        className="grid gap-4 lg:grid-cols-2"
      >
        <GlassPanel className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
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
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
            Accounts
          </h2>

          <ul className="flex flex-col gap-2 text-sm">
            {(overview?.users ?? []).map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-text">{account.email}</span>

                {account.role === null ? null : <Badge size="sm">{account.role}</Badge>}
              </li>
            ))}
          </ul>

          <p className="text-xs text-text-muted">
            {overview === null
              ? ''
              : `Cookies are ${overview.settings.cookieSecure ? 'secure' : 'not secure'} · origins: ${overview.settings.trustedOrigins.join(', ')}`}
          </p>
        </GlassPanel>
      </motion.section>
    </motion.div>
  )
}

AdminArea.displayName = 'AdminArea'

export default { AdminArea }
