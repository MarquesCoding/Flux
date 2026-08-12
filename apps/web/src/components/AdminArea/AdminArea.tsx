import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCpu,
  IconDatabase,
  IconPlayerPlay,
  IconStack2,
} from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { SideNav } from '@FluxUI/SideNav';
import { TabPanel } from '@FluxUI/TabPanel';
import { EventsPanel } from './components/EventsPanel/EventsPanel';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { JobsPanel } from './components/JobsPanel/JobsPanel';
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel';
import { LibrariesPanel } from './components/LibrariesPanel/LibrariesPanel';
import { OverviewPanel } from './components/OverviewPanel/OverviewPanel';
import { Tabs } from '@FluxUI/Tabs';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import {
  fetchAdminOverview,
  fetchMonitor,
  watchMonitor,
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
import {
  subscribe as subscribeToScans,
  getSnapshot as getScanSnapshot,
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
} from './scanCoordinator';
import { formatBytes } from './formatBytes';
import type { Library } from '@FluxContracts/schemas/Library';
import type {
  ActiveSession,
  AdminOverview,
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

/**
 * The sections, grouped as somebody looking for one would.
 *
 * Grouped rather than listed because this list is going to grow — logs, roles,
 * accounts, backups and webhooks all want a place — and a flat column of
 * fourteen is as hard to read as a row of fourteen was.
 */
const SECTIONS = [
  { label: null, items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Activity',
    items: [
      { id: 'activity', label: 'Now' },
      { id: 'jobs', label: 'Jobs' },
      { id: 'events', label: 'Events' },
    ],
  },
  { label: 'Content', items: [{ id: 'libraries', label: 'Libraries' }] },
  { label: 'System', items: [{ id: 'settings', label: 'Settings' }] },
] as const;

type PanelId = (typeof SECTIONS)[number]['items'][number]['id'];

const PANELS: readonly { id: PanelId; label: string }[] = SECTIONS.flatMap((section) => [
  ...section.items,
]);

/**
 * Every job's triggers, keyed by kind.
 *
 * Read back from the server rather than reasoned about locally whenever a
 * write failed: after a failure the page has no idea what actually landed,
 * and guessing is how a schedule page starts lying about what is set.
 */
const readJobSchedules = async (): Promise<Map<string, JobTrigger[]>> =>
  new Map((await fetchJobSchedules()).map((entry) => [entry.kind, entry.triggers]));

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
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [panel, setPanel] = useState<PanelId>(
    () => PANELS.find((candidate) => candidate.id === initialPanel)?.id ?? 'activity',
  );
  const [viewingJobKind, setViewingJobKind] = useState<string | null>(initialJob ?? null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [jobDefinitions, setJobDefinitions] = useState<JobDefinition[]>([]);
  const [jobSchedules, setJobSchedules] = useState<Map<string, JobTrigger[]>>(new Map());
  const {
    progress: scanProgress,
    isScanningAll,
    isResettingAll,
  } = useSyncExternalStore(subscribeToScans, getScanSnapshot);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const onLibraryUpdated = (updated: Library) => {
    setLibraries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  };

  const onLibraryCreated = (library: Library) => {
    setLibraries((current) => [...current, library]);
  };

  const rescan = async (libraryId: string) => {
    await startScan(libraryId);
    setLibraries(await fetchLibraries());
  };

  const rescanAll = async () => {
    await startScanAll(libraries);
    setLibraries(await fetchLibraries());
  };

  const resetAll = async () => {
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
    void fetchAdminOverview().then(setOverview);
    void fetchMonitor().then(setMonitor);
    void fetchLibraries().then(setLibraries);
    void fetchActiveSessions().then(setSessions);
    void fetchJobDefinitions().then(setJobDefinitions);
    void readJobSchedules().then(setJobSchedules);
  }, []);

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

  const resources = monitor?.resources ?? null;
  const memoryFraction =
    resources === null || resources.systemMemoryTotalBytes === 0
      ? 0
      : resources.systemMemoryUsedBytes / resources.systemMemoryTotalBytes;

  const conversions = resources?.children ?? [];

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-20 pt-14 sm:px-10"
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

        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex flex-col gap-6 lg:grid lg:grid-cols-[15rem_1fr] lg:items-start lg:gap-8"
        >
          <SideNav
            groups={SECTIONS.map((section) => ({
              label: section.label,
              items: [...section.items],
            }))}
            label="What to look at"
          />

          <section className="min-h-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <TabPanel
              value="overview"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <OverviewPanel
                overview={overview}
                monitor={monitor}
                libraries={libraries}
                sessions={sessions}
                onOpenPanel={(next) => {
                  const found = PANELS.find((candidate) => candidate.id === next);

                  if (found !== undefined) {
                    setPanel(found.id);
                    onPanelChange?.(found.id);
                  }
                }}
              />
            </TabPanel>

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
              <ActivityPanel
                history={history}
                monitor={monitor}
                sessions={sessions}
                busyClientId={busyClientId}
                onStop={(clientId) => {
                  void stopStream(clientId);
                }}
                onPause={(clientId) => {
                  void pauseStream(clientId);
                }}
                onResume={(clientId) => {
                  void resumeStream(clientId);
                }}
              />
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
              <JobsPanel
                definitions={jobDefinitions}
                libraries={libraries}
                progress={scanProgress}
                monitor={monitor}
                viewingJobKind={viewingJobKind}
                schedules={jobSchedules}
                onRun={(kind) => {
                  void runJob(kind);
                }}
                onOpenSchedule={openJobSchedule}
                onCloseSchedule={closeJobSchedule}
                onAddTrigger={(kind, trigger) => {
                  void addTrigger(kind, trigger);
                }}
                onRemoveTrigger={(kind, triggerId) => {
                  void removeTrigger(kind, triggerId);
                }}
              />
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
              <EventsPanel monitor={monitor} />
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
              <LibrariesPanel
                libraries={libraries}
                progress={scanProgress}
                isScanningAll={isScanningAll}
                isResettingAll={isResettingAll}
                onScan={(libraryId) => {
                  void rescan(libraryId);
                }}
                onScanAll={() => {
                  void rescanAll();
                }}
                onResetAll={() => {
                  void resetAll();
                }}
                onRegeneratePreviews={(libraryId) => {
                  void regeneratePreviews(libraryId);
                }}
                onLibraryCreated={onLibraryCreated}
                onLibraryUpdated={onLibraryUpdated}
              />
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
              <SettingsPanel
                overview={overview}
                onCatalogueKeySaved={() => {
                  void fetchAdminOverview().then(setOverview);
                }}
              />
            </TabPanel>
          </section>
        </motion.div>
      </Tabs>
    </motion.div>
  );
};

AdminArea.displayName = 'AdminArea';

export { AdminArea };
