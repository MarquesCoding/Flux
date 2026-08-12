import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
  IconSearch,
  IconStack2,
  IconTrash,
} from '@tabler/icons-react';
import { Sparkline } from '@FluxUI/Sparkline';
import { MatchPicker } from './components/MatchPicker/MatchPicker';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { TabBar } from '@FluxUI/TabBar';
import { TabPanel } from '@FluxUI/TabPanel';
import { Tabs } from '@FluxUI/Tabs';
import { TextField } from '@FluxUI/TextField';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import {
  fetchAdminOverview,
  fetchMonitor,
  watchMonitor,
  saveCatalogueKey,
  fetchActiveSessions,
  stopSession,
  pauseSession,
  resumeSession,
  fetchJobDefinitions,
  fetchJobSchedules,
  addJobTrigger,
  removeJobTrigger,
} from '@FluxWeb/admin/fetchAdmin';
import { fetchLibraries } from '@FluxWeb/library/fetchLibrary';
import { StatStrip } from './components/StatStrip/StatStrip';
import { AddLibraryDialog } from './components/AddLibraryDialog/AddLibraryDialog';
import { ScanProgressBar } from './components/ScanProgressBar/ScanProgressBar';
import { ResetLibrariesDialog } from './components/ResetLibrariesDialog/ResetLibrariesDialog';
import { LibrarySettingsDialog } from './components/LibrarySettingsDialog/LibrarySettingsDialog';
import { SessionCard } from './components/SessionCard/SessionCard';
import { JobRunner } from './components/JobRunner/JobRunner';
import { JobSchedulePage } from './components/JobSchedulePage/JobSchedulePage';
import {
  resumeRunning,
  subscribe as subscribeToScans,
  getSnapshot as getScanSnapshot,
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
} from './scanCoordinator';
import { readWholeLibrary } from '@FluxWeb/library/readWholeLibrary';
import { formatBytes } from './formatBytes';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';
import type {
  ActiveSession,
  AdminOverview,
  Job,
  JobDefinition,
  JobTrigger,
  Monitor,
  ScheduleTrigger,
} from '@FluxWeb/admin/fetchAdmin';
import type { AdminAreaProps } from './AdminArea.types';

/**
 * How many readings stay on screen.
 */
const HISTORY_LENGTH = 60;

/**
 * How often the list of active streams is refreshed.
 *
 * Slower than the resource stream on purpose: who is watching what changes at
 * human timescale — someone pressing play or closing a tab — not every
 * second the way CPU and memory do.
 */
const SESSIONS_POLL_MILLISECONDS = 5000;

const PANELS = [
  { id: 'activity', label: 'Activity' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'events', label: 'Events' },
  { id: 'libraries', label: 'Libraries' },
  { id: 'media', label: 'Media' },
  { id: 'settings', label: 'Settings' },
] as const;

type PanelId = (typeof PANELS)[number]['id'];

const JOB_TONES: Record<Job['state'], 'quiet' | 'accent' | 'solid'> = {
  queued: 'quiet',
  running: 'accent',
  finished: 'quiet',
  failed: 'solid',
};

/**
 * How long a job took, or has been taking.
 */
const describeElapsed = (job: Job, now: number): string => {
  if (job.startedAtMs === null) {
    return 'waiting';
  }

  const elapsed = (job.finishedAtMs ?? now) - job.startedAtMs;

  return elapsed < 1000
    ? `${elapsed.toString()} ms`
    : `${(elapsed / 1000).toFixed(elapsed < 10_000 ? 1 : 0)} s`;
};

const atTime = (ms: number): string => new Date(ms).toLocaleTimeString();

/**
 * Every job's triggers, keyed by kind.
 *
 * Read back from the server rather than reasoned about locally whenever a
 * write failed: after a failure the page has no idea what actually landed,
 * and guessing is how a schedule page starts lying about what is set.
 */
const readJobSchedules = async (): Promise<Map<string, JobTrigger[]>> =>
  new Map((await fetchJobSchedules()).map((entry) => [entry.kind, entry.triggers]));

type SessionGroup = { key: string; label: string; sessions: ActiveSession[] };

/**
 * Separates every open tab out by who has it open, so an admin can see every
 * session a given viewer has running rather than one flat list.
 */
const groupSessionsByViewer = (sessions: ActiveSession[]): SessionGroup[] => {
  const groups = new Map<string, SessionGroup>();

  for (const session of sessions) {
    const key = session.profileId ?? 'unknown';
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, { key, label: session.profileName ?? 'Unknown viewer', sessions: [session] });
    } else {
      existing.sessions.push(session);
    }
  }

  return [...groups.values()];
};

/**
 * Trims what ffmpeg calls itself down to a version.
 *
 * Its own answer is a sentence with a copyright notice in it, which is not how
 * a line reading "Media service up" should end.
 */
const shortVersion = (reported: string | null): string => {
  if (reported === null) {
    return 'unknown';
  }

  return /ffmpeg version (\S+)/.exec(reported)?.[1] ?? reported.slice(0, 24);
};

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
const AdminArea = ({
  historyLength = HISTORY_LENGTH,
  initialPanel,
  onPanelChange,
  initialJob,
  onJobChange,
}: AdminAreaProps) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewProblem, setOverviewProblem] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaSummary[]>([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [correcting, setCorrecting] = useState<MediaSummary | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [panel, setPanel] = useState<PanelId>(
    () => PANELS.find((candidate) => candidate.id === initialPanel)?.id ?? 'activity',
  );
  const [viewingJobKind, setViewingJobKind] = useState<string | null>(initialJob ?? null);
  const [catalogueKey, setCatalogueKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [jobDefinitions, setJobDefinitions] = useState<JobDefinition[]>([]);
  const [jobSchedules, setJobSchedules] = useState<Map<string, JobTrigger[]>>(new Map());
  const [isAddingLibrary, setIsAddingLibrary] = useState(false);
  const {
    progress: scanProgress,
    isScanningAll,
    isResettingAll,
  } = useSyncExternalStore(subscribeToScans, getScanSnapshot);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [settingsLibraryId, setSettingsLibraryId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const onLibraryUpdated = (updated: Library) => {
    setLibraries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  };

  const onLibraryCreated = (library: Library) => {
    setLibraries((current) => [...current, library]);
    setIsAddingLibrary(false);
  };

  const rescan = async (libraryId: string, force = false) => {
    await startScan(libraryId, force);
    setLibraries(await fetchLibraries());
  };

  const rescanAll = async () => {
    await startScanAll(libraries);
    setLibraries(await fetchLibraries());
  };

  const resetAll = async () => {
    setIsConfirmingReset(false);
    await startResetAll(libraries);
    setLibraries(await fetchLibraries());
  };

  const regeneratePreviews = async (libraryId: string) => {
    await startRegeneratePreviews(libraryId);
  };

  const runJob = async (kind: string) => {
    const definition = jobDefinitions.find((candidate) => candidate.kind === kind);

    if (definition?.needsLibrary === true) {
      await runDefinedJobAll(kind, libraries);
    } else {
      await runDefinedJob(kind);
    }

    setLibraries(await fetchLibraries());
  };

  const addTrigger = async (kind: string, trigger: ScheduleTrigger) => {
    const added = await addJobTrigger(kind, trigger);

    if (added === null) {
      setJobSchedules(await readJobSchedules());

      return;
    }

    setJobSchedules((current) => new Map(current).set(kind, [...(current.get(kind) ?? []), added]));
  };

  const removeTrigger = async (kind: string, triggerId: string) => {
    setJobSchedules((current) =>
      new Map(current).set(
        kind,
        (current.get(kind) ?? []).filter((entry) => entry.id !== triggerId),
      ),
    );

    if (!(await removeJobTrigger(kind, triggerId))) {
      setJobSchedules(await readJobSchedules());
    }
  };

  const openJobSchedule = (kind: string) => {
    setViewingJobKind(kind);
    onJobChange?.(kind);
  };

  const closeJobSchedule = () => {
    setViewingJobKind(null);
    onJobChange?.(null);
  };

  const stopStream = async (clientId: string) => {
    setBusyClientId(clientId);

    try {
      await stopSession(clientId);
      setSessions(await fetchActiveSessions());
    } finally {
      setBusyClientId(null);
    }
  };

  const pauseStream = async (clientId: string) => {
    setBusyClientId(clientId);

    try {
      await pauseSession(clientId);
      setSessions(await fetchActiveSessions());
    } finally {
      setBusyClientId(null);
    }
  };

  const resumeStream = async (clientId: string) => {
    setBusyClientId(clientId);

    try {
      await resumeSession(clientId);
      setSessions(await fetchActiveSessions());
    } finally {
      setBusyClientId(null);
    }
  };

  useEffect(() => {
    void fetchAdminOverview().then((outcome) => {
      setOverview(outcome.overview);
      setOverviewProblem(outcome.problem);
    });
    void fetchMonitor().then(setMonitor);
    void fetchLibraries().then(setLibraries);
    void fetchActiveSessions().then(setSessions);
    void fetchJobDefinitions().then(setJobDefinitions);
    void readJobSchedules().then(setJobSchedules);
    void resumeRunning();
  }, []);

  /**
   * One row per programme and per film, rather than one per file: a correction
   * names a programme, so a list of ninety episodes would be ninety ways to do
   * the same thing.
   */
  const shownMedia = media
    .filter((item) =>
      (item.seriesTitle ?? item.title).toLowerCase().includes(mediaSearch.trim().toLowerCase()),
    )
    .sort((left, right) =>
      (left.seriesTitle ?? left.title).localeCompare(right.seriesTitle ?? right.title),
    );

  const readMedia = useCallback(async () => {
    const found = await fetchLibraries().catch(() => []);
    const shelves = await Promise.all(found.map((library) => readWholeLibrary(library.id)));
    const everything = shelves.flat();
    const byThing = new Map<string, MediaSummary>();

    for (const item of everything) {
      const key = item.seriesTitle ?? item.id;

      if (!byThing.has(key)) {
        byThing.set(key, item);
      }
    }

    setMedia([...byThing.values()]);
  }, []);

  useEffect(() => {
    void readMedia();
  }, [readMedia]);

  useEffect(() => {
    const poll = setInterval(() => {
      void fetchActiveSessions().then(setSessions);
    }, SESSIONS_POLL_MILLISECONDS);

    return () => {
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const stop = watchMonitor((reading) => {
      setMonitor(reading);
      setHistory((current) =>
        [...current, reading.resources.systemCpuPercent].slice(-historyLength),
      );
    });

    return stop;
  }, [historyLength]);

  const now = Date.now();
  const resources = monitor?.resources ?? null;
  const memoryFraction =
    resources === null || resources.systemMemoryTotalBytes === 0
      ? 0
      : resources.systemMemoryUsedBytes / resources.systemMemoryTotalBytes;

  const failures = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'failed').length;
  const conversions = resources?.children ?? [];
  const viewingJobDefinition =
    viewingJobKind === null
      ? null
      : (jobDefinitions.find((definition) => definition.kind === viewingJobKind) ?? null);

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-16 pt-14 sm:px-10"
    >
      <Tabs
        value={panel}
        onValueChange={(next) => {
          const found = PANELS.find((candidate) => candidate.id === next);

          if (found !== undefined) {
            setPanel(found.id);
            onPanelChange?.(found.id);
            setViewingJobKind(null);
            onJobChange?.(null);
          }
        }}
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
                  ? (overviewProblem ?? 'Reading the server…')
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

          <TabBar tabs={[...PANELS]} label="What to look at" />
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
          className="min-h-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <TabPanel
            value="activity"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
            <>
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

              <div className="flex flex-col gap-5 border-t border-white/10 bg-surface/40 p-5">
                <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                  Active Sessions
                </h2>

                {sessions.length === 0 ? (
                  <p className="text-sm text-text-muted">Nobody has the app open right now.</p>
                ) : (
                  groupSessionsByViewer(sessions).map((group) => (
                    <div key={group.key} className="flex flex-col gap-3">
                      <h3 className="text-xs font-medium text-text">{group.label}</h3>

                      <div className="flex flex-wrap gap-3">
                        {group.sessions.map((session) => (
                          <SessionCard
                            key={session.clientId}
                            session={session}
                            isBusy={busyClientId === session.clientId}
                            onStop={() => {
                              void stopStream(session.clientId);
                            }}
                            onPause={() => {
                              void pauseStream(session.clientId);
                            }}
                            onResume={() => {
                              void resumeStream(session.clientId);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          </TabPanel>

          <TabPanel
            value="jobs"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
            <div className="flex flex-col">
              {viewingJobDefinition !== null ? (
                <JobSchedulePage
                  definition={viewingJobDefinition}
                  triggers={jobSchedules.get(viewingJobDefinition.kind) ?? []}
                  onAdd={(trigger) => {
                    void addTrigger(viewingJobDefinition.kind, trigger);
                  }}
                  onRemove={(triggerId) => {
                    void removeTrigger(viewingJobDefinition.kind, triggerId);
                  }}
                  onClose={closeJobSchedule}
                />
              ) : (
                <>
                  <header className="border-b border-white/10 px-5 py-3">
                    <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                      Server Jobs
                    </h2>
                  </header>

                  <JobRunner
                    definitions={jobDefinitions}
                    libraries={libraries}
                    progress={scanProgress}
                    onRun={(kind) => {
                      void runJob(kind);
                    }}
                    onOpenSchedule={openJobSchedule}
                  />

                  <header className="flex flex-wrap items-baseline justify-between gap-3 border-y border-white/10 px-5 py-3">
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
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel
            value="events"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
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
          </TabPanel>

          <TabPanel
            value="libraries"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
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
                      void rescanAll();
                    }}
                  >
                    <IconRefreshAlert size={16} aria-hidden />
                    Scan all libraries
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    isPill
                    isLoading={isResettingAll}
                    disabled={libraries.length === 0 || scanProgress.size > 0}
                    onClick={() => {
                      setIsConfirmingReset(true);
                    }}
                  >
                    <IconTrash size={16} aria-hidden />
                    Reset and rebuild
                  </Button>

                  <Button
                    variant="glossy"
                    size="sm"
                    isPill
                    onClick={() => {
                      setIsAddingLibrary(true);
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
                    const progress = scanProgress.get(library.id);

                    return (
                      <li
                        key={library.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex items-center gap-2 text-sm text-text">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto rounded-none bg-transparent p-0 text-sm text-text hover:bg-transparent hover:underline"
                              onClick={() => {
                                setSettingsLibraryId(library.id);
                              }}
                            >
                              {library.name}
                            </Button>
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
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                isPill
                                label="Read every file again, not only the ones that changed"
                                onClick={() => {
                                  void rescan(library.id, true);
                                }}
                              >
                                <IconRefreshAlert size={16} aria-hidden />
                                Read again
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                isPill
                                onClick={() => {
                                  void rescan(library.id);
                                }}
                              >
                                <IconRefresh size={16} aria-hidden />
                                Scan
                              </Button>
                            </>
                          ) : (
                            <ScanProgressBar
                              label={
                                progress.kind === 'scan'
                                  ? `Scanning ${library.name}`
                                  : `Regenerating previews for ${library.name}`
                              }
                              phase={progress.phase}
                              processed={progress.processed}
                              total={progress.total}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <AddLibraryDialog
                isOpen={isAddingLibrary}
                onClose={() => {
                  setIsAddingLibrary(false);
                }}
                onCreated={onLibraryCreated}
              />

              <ResetLibrariesDialog
                isOpen={isConfirmingReset}
                isResetting={isResettingAll}
                onClose={() => {
                  setIsConfirmingReset(false);
                }}
                onConfirm={() => {
                  void resetAll();
                }}
              />

              <LibrarySettingsDialog
                key={settingsLibraryId ?? 'none'}
                library={libraries.find((entry) => entry.id === settingsLibraryId) ?? null}
                isOpen={settingsLibraryId !== null}
                onClose={() => {
                  setSettingsLibraryId(null);
                }}
                onUpdated={onLibraryUpdated}
                onRegenerate={(libraryId) => {
                  void regeneratePreviews(libraryId);
                }}
              />
            </div>
          </TabPanel>

          <TabPanel
            value="media"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
            <div className="flex flex-col">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">
                  Everything in the libraries
                </h2>

                <TextField
                  label="Find a programme or film"
                  isLabelHidden
                  type="search"
                  placeholder="Find a title"
                  value={mediaSearch}
                  onValueChange={setMediaSearch}
                  className="w-64 max-w-full"
                />
              </header>

              {shownMedia.length === 0 ? (
                <p className="px-5 py-6 font-body text-sm text-text-muted">
                  {media.length === 0
                    ? 'Nothing has been scanned yet.'
                    : 'Nothing here matches that.'}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-white/5">
                  {shownMedia.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-text">
                          {item.seriesTitle ?? item.title}
                        </span>
                        <span className="truncate font-body text-xs text-text-muted">
                          {item.seriesTitle === null || item.seriesTitle === undefined
                            ? 'Film'
                            : 'Series'}
                          {item.year === null ? '' : ` · ${item.year.toString()}`}
                        </span>
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        isPill
                        onClick={() => {
                          setCorrecting(item);
                        }}
                      >
                        <IconSearch size={16} aria-hidden />
                        Wrong match?
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabPanel>

          <TabPanel
            value="settings"
            render={
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            }
          >
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
                      setIsSaving(true);

                      void saveCatalogueKey(catalogueKey).then(async (saved) => {
                        setIsSaving(false);

                        if (saved) {
                          setCatalogueKey('');
                          {
                            const outcome = await fetchAdminOverview();

                            setOverview(outcome.overview);
                            setOverviewProblem(outcome.problem);
                          }
                        }
                      });
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
          </TabPanel>
        </motion.section>
      </Tabs>
      <MatchPicker
        media={correcting}
        onClose={() => {
          setCorrecting(null);
        }}
        onCorrected={() => {
          void readMedia();
        }}
      />
    </motion.div>
  );
};

AdminArea.displayName = 'AdminArea';

export { AdminArea };
