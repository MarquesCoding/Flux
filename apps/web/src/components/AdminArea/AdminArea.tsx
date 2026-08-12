import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { TabRow } from '@FluxUI/TabRow';
import { TabPanel } from '@FluxUI/TabPanel';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { JobsPanel } from './components/JobsPanel/JobsPanel';
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel';
import { LibrariesPanel } from './components/LibrariesPanel/LibrariesPanel';
import { MediaPanel } from './components/MediaPanel/MediaPanel';
import { MatchPicker } from './components/MatchPicker/MatchPicker';
import { OverviewPanel } from './components/OverviewPanel/OverviewPanel';
import { RolesPanel } from './components/RolesPanel/RolesPanel';
import { AccountsPanel } from './components/AccountsPanel/AccountsPanel';
import { Tabs } from '@FluxUI/Tabs';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import {
  fetchAdminOverview,
  fetchMonitor,
  watchMonitor,
  fetchActiveSessions,
  watchActiveSessions,
  stopSession,
  pauseSession,
  resumeSession,
  fetchJobDefinitions,
  fetchJobSchedules,
  addJobTrigger,
  removeJobTrigger,
} from '@FluxWeb/admin/fetchAdmin';
import { fetchLibraries, rebuildArtefacts } from '@FluxWeb/library/fetchLibrary';
import { StatStrip } from './components/StatStrip/StatStrip';
import { ConcernsBanner } from './components/ConcernsBanner/ConcernsBanner';
import { collectConcerns } from './collectConcerns';
import { readWholeLibrary } from '@FluxWeb/library/readWholeLibrary';
import {
  resumeRunning,
  watchJob,
  subscribe as subscribeToScans,
  getSnapshot as getScanSnapshot,
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
  stopJobs,
} from './scanCoordinator';
import { formatBytes } from './formatBytes';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';
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
      { id: 'activity', label: 'Sessions' },
      { id: 'jobs', label: 'Jobs' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'libraries', label: 'Libraries' },
      { id: 'media', label: 'Media' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'accounts', label: 'Accounts' },
      { id: 'roles', label: 'Roles' },
    ],
  },
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
    () => PANELS.find((candidate) => candidate.id === initialPanel)?.id ?? 'overview',
  );
  const [viewingJobKind, setViewingJobKind] = useState<string | null>(initialJob ?? null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [media, setMedia] = useState<MediaSummary[]>([]);
  const [correcting, setCorrecting] = useState<MediaSummary | null>(null);
  const [unreachable, setUnreachable] = useState<ReadonlySet<string>>(new Set());
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

  /**
   * Reads one thing, and remembers when it could not be read.
   *
   * Failure has to be told apart from emptiness, because the two look
   * identical on screen and only one of them means "add a library". A fetch
   * that rejects used to leave the panel showing its empty state, which is
   * advice rather than a mistake — it invites somebody to add a library they
   * already have.
   */
  const loadInto = useCallback(
    async <T,>(key: string, read: () => Promise<T>, apply: (value: T) => void) => {
      try {
        apply(await read());

        setUnreachable((current) => new Set([...current].filter((name) => name !== key)));
      } catch {
        setUnreachable((current) => new Set([...current, key]));
      }
    },
    [],
  );

  /**
   * Every programme and film across every library.
   *
   * Read library by library rather than in one call, since there is no route
   * that spans them, and folded to one entry per programme: a correction names
   * a programme, so ninety episodes would be ninety ways to do the same thing.
   */
  const readMedia = useCallback(async () => {
    const found = await fetchLibraries();
    const shelves = await Promise.all(found.map((entry) => readWholeLibrary(entry.id)));
    const byThing = new Map<string, MediaSummary>();

    for (const item of shelves.flat()) {
      const key = item.seriesTitle ?? item.id;

      if (!byThing.has(key)) {
        byThing.set(key, item);
      }
    }

    return [...byThing.values()];
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadInto('overview', fetchAdminOverview, setOverview),
      loadInto('media', readMedia, setMedia),
      loadInto('monitor', fetchMonitor, setMonitor),
      loadInto('libraries', fetchLibraries, setLibraries),
      loadInto('sessions', fetchActiveSessions, setSessions),
      loadInto('jobs', fetchJobDefinitions, setJobDefinitions),
      loadInto('schedules', readJobSchedules, setJobSchedules),
    ]);
  }, [loadInto, readMedia]);

  const onLibraryUpdated = (updated: Library) => {
    setLibraries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  };

  const onLibraryCreated = (library: Library) => {
    setLibraries((current) => [...current, library]);
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
    await startResetAll(libraries);
    setLibraries(await fetchLibraries());
  };

  const regeneratePreviews = async (libraryId: string) => {
    await startRegeneratePreviews(libraryId);
  };

  const runJob = useCallback(
    async (kind: string) => {
      const definition = jobDefinitions.find((candidate) => candidate.kind === kind);

      if (definition?.needsLibrary === true) {
        await runDefinedJobAll(kind, libraries);
      } else {
        await runDefinedJob(kind);
      }

      setLibraries(await fetchLibraries());
    },
    [jobDefinitions, libraries],
  );

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

  const openJobSchedule = useCallback(
    (kind: string) => {
      setViewingJobKind(kind);
      onJobChange?.(kind);
    },
    [onJobChange],
  );

  const closeJobSchedule = useCallback(() => {
    setViewingJobKind(null);
    onJobChange?.(null);
  }, [onJobChange]);

  /**
   * Starting a job, in a shape that keeps its identity between renders.
   *
   * The jobs table builds its columns from this, and a column definition
   * rebuilt each pass remounts every cell — which closes any menu open in a
   * row. This page redraws about once a second while the monitor streams, so
   * an unstable handler here means a menu that cannot be used at all.
   */
  const startJob = useCallback(
    (kind: string) => {
      void runJob(kind);
    },
    [runJob],
  );

  const stopJob = useCallback((kind: string) => {
    void stopJobs(kind);
  }, []);

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
    void loadAll();
    void resumeRunning();
  }, [loadAll]);

  useEffect(() => watchActiveSessions(setSessions), []);

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
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-6 pt-5 sm:px-10"
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
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex justify-center"
        >
          <TabRow
            groups={SECTIONS.map((section) => ({
              ...(section.label === null ? {} : { label: section.label }),
              items: section.items,
            }))}
            label="What to look at"
          />
        </motion.div>

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
          <ConcernsBanner
            concerns={collectConcerns({ overview, monitor, libraries, sessions, history })}
            onOpenPanel={(next) => {
              const found = PANELS.find((candidate) => candidate.id === next);

              if (found !== undefined) {
                setPanel(found.id);
                onPanelChange?.(found.id);
              }
            }}
          />
        </motion.div>

        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
        >
          <StatStrip
            stats={[
              {
                label: 'Processor',
                value: `${(resources?.systemCpuPercent ?? 0).toFixed(0)}%`,
                fraction: (resources?.systemCpuPercent ?? 0) / 100,
                detail:
                  resources === null
                    ? '—'
                    : `${resources.cpuCount.toString()} cores · load ${resources.loadAverage.toFixed(2)}`,
              },
              {
                label: 'Memory',
                value: resources === null ? '—' : formatBytes(resources.systemMemoryUsedBytes),
                fraction: memoryFraction,
                detail:
                  resources === null
                    ? '—'
                    : `of ${formatBytes(resources.systemMemoryTotalBytes)} · service ${formatBytes(resources.serviceMemoryBytes)}`,
              },
              {
                label: 'Streaming',
                value: (monitor?.sessions ?? 0).toString(),
                detail: `${conversions.length.toString()} conversions running`,
              },
              {
                label: 'Library',
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

        {unreachable.size === 0 ? null : (
          <motion.p
            role="alert"
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-text"
          >
            <IconAlertTriangle size={18} className="shrink-0 text-danger" aria-hidden />
            Some of this could not be read from the server, so parts of the page may be missing
            rather than empty.
            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                void loadAll();
              }}
            >
              Try again
            </Button>
          </motion.p>
        )}

        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex flex-col gap-5"
        >
          <section>
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
                history={history}
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
                onRun={startJob}
                onStop={stopJob}
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
                onScan={(libraryId, force) => {
                  void rescan(libraryId, force);
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
              value="media"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <MediaPanel
                isUnreachable={unreachable.has('media')}
                media={media}
                onCorrect={setCorrecting}
                onRebuildArtefacts={async (item) => (await rebuildArtefacts(item.id)) !== null}
              />
            </TabPanel>

            <TabPanel
              value="accounts"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <AccountsPanel />
            </TabPanel>

            <TabPanel
              value="roles"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <RolesPanel />
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

      <MatchPicker
        media={correcting}
        onClose={() => {
          setCorrecting(null);
        }}
        onCorrected={(jobId) => {
          const libraryId = correcting?.libraryId ?? null;

          void (
            jobId === null || libraryId === null
              ? Promise.resolve()
              : watchJob(libraryId, 'library.readAgain', jobId)
          ).then(async () => {
            setMedia(await readMedia());
          });
        }}
      />
    </motion.div>
  );
};

AdminArea.displayName = 'AdminArea';

export { AdminArea };
