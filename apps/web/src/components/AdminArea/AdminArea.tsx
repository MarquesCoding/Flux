import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { RiAlertLine, RiCheckboxCircleLine } from '@remixicon/react';
import { Badge } from '@FluxUI/Badge';
import { HoverCard } from '@FluxUI/HoverCard';
import { Button } from '@FluxUI/Button';
import { SectionBar } from '@FluxUI/SectionBar';
import { TabPanel } from '@FluxUI/TabPanel';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { JobsPanel } from './components/JobsPanel/JobsPanel';
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel';
import { LogsPanel } from './components/LogsPanel/LogsPanel';
import { LibrariesPanel } from './components/LibrariesPanel/LibrariesPanel';
import { MediaPanel } from './components/MediaPanel/MediaPanel';
import { MatchPicker } from './components/MatchPicker/MatchPicker';
import { OverviewPanel } from './components/OverviewPanel/OverviewPanel';
import { RolesPanel } from './components/RolesPanel/RolesPanel';
import { WebhooksPanel } from './components/WebhooksPanel/WebhooksPanel';
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  fetchWebhooks,
  redeliverWebhook,
  setWebhookEnabled,
  testWebhook,
} from '@FluxWeb/admin/fetchWebhooks';
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
  messageSession,
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
import { fluxCpuShare } from './fluxCpuShare';
import { libraryDisk } from './libraryDisk';
import { describeGraphics } from './describeGraphics';
import { describeCpuShare } from './describeCpuShare';
import { describeFfmpeg } from './describeFfmpeg';
import { describeAcceleration } from './describeAcceleration';
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
import { formatBytes } from '@FluxCore/functions/formatBytes';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';
import type {
  ActiveSession,
  AdminOverview,
  JobDefinition,
  JobTrigger,
  Monitor,
  ScheduleTrigger,
} from '@FluxWeb/admin/fetchAdmin';
import type { WebhookDelivery, WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { CreatedWebhook } from '@FluxWeb/admin/fetchWebhooks';
import type { AdminAreaProps } from './AdminArea.types';

const HISTORY_LENGTH = 60;

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
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings' },
      { id: 'webhooks', label: 'Webhooks' },
      { id: 'logs', label: 'Logs' },
    ],
  },
] as const;

type PanelId = (typeof SECTIONS)[number]['items'][number]['id'];

const PANELS: readonly { id: PanelId; label: string }[] = SECTIONS.flatMap((section) => [
  ...section.items,
]);

/**
 * Reads every job's triggers at once and keys them by job, so that a list of jobs can show what makes
 * each run without a request per row.
 */
const readJobSchedules = async (): Promise<{
  byKind: Map<string, JobTrigger[]>;
  timezone: string | null;
}> => {
  const { schedules, timezone } = await fetchJobSchedules();

  return { byKind: new Map(schedules.map((entry) => [entry.kind, entry.triggers])), timezone };
};

/**
 * The server as the person running it sees it: the dashboard, what is being watched, the libraries
 * and what they hold, the jobs, the settings and the webhooks. Owns the polling that keeps all of it
 * current and the state that outlives any one panel, so that moving between panels neither restarts
 * a scan's tracking nor refetches everything.
 *
 * Which panel is open, and which job's schedule within it, are held above this component rather than
 * inside it, so that both are places the browser's address can name and return to.
 *
 * @param historyLength - How many readings to keep for the graphs.
 * @param initialPanel - The panel to open, where the address named one.
 * @param onPanelChange - Called with the panel that was opened.
 * @param initialJob - The job whose schedule to open, where the address named one.
 * @param onJobChange - Called with the job whose schedule was opened, or null on going back.
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
  const [encoderHistory, setEncoderHistory] = useState<number[]>([]);
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
  const [jobsTimezone, setJobsTimezone] = useState<string | null>(null);
  const {
    progress: scanProgress,
    isScanningAll,
    isResettingAll,
  } = useSyncExternalStore(subscribeToScans, getScanSnapshot);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [createdWebhook, setCreatedWebhook] = useState<CreatedWebhook | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const showPanel = useCallback(
    (next: string) => {
      const found = PANELS.find((candidate) => candidate.id === next);

      if (found === undefined) {
        return;
      }

      setPanel(found.id);
      onPanelChange?.(found.id);
      setViewingJobKind(null);
      onJobChange?.(null);
    },
    [onPanelChange, onJobChange],
  );

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
      loadInto('schedules', readJobSchedules, ({ byKind, timezone }) => {
        setJobSchedules(byKind);
        setJobsTimezone(timezone);
      }),
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
      setJobSchedules((await readJobSchedules()).byKind);

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
      setJobSchedules((await readJobSchedules()).byKind);
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

  const tellViewer = async (clientId: string, text: string) => {
    setBusyClientId(clientId);

    try {
      await messageSession(clientId, text);
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

  const reloadWebhooks = useCallback(async () => {
    setWebhooks(await fetchWebhooks());
  }, []);

  useEffect(() => {
    if (panel === 'webhooks') {
      void reloadWebhooks();
    }
  }, [panel, reloadWebhooks]);

  const reloadDeliveries = useCallback(async (id: string) => {
    setIsHistoryLoading(true);

    try {
      setDeliveries(await fetchWebhookDeliveries(id));
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (openHistoryId === null) {
      setDeliveries([]);

      return;
    }

    void reloadDeliveries(openHistoryId);
  }, [openHistoryId, reloadDeliveries]);

  useEffect(() => watchActiveSessions(setSessions), []);

  useEffect(() => {
    const stop = watchMonitor((reading) => {
      setMonitor(reading);
      setHistory((current) =>
        [...current, reading.resources.systemCpuPercent].slice(-historyLength),
      );
      setEncoderHistory((current) => {
        const encoder = reading.resources.graphics?.encoderPercent ?? null;

        return encoder === null ? [] : [...current, encoder].slice(-historyLength);
      });
    });

    return stop;
  }, [historyLength]);

  const resources = monitor?.resources ?? null;
  const memoryFraction =
    resources === null || resources.systemMemoryTotalBytes === 0
      ? 0
      : resources.systemMemoryUsedBytes / resources.systemMemoryTotalBytes;

  const conversions = resources?.children ?? [];
  const cpuShare = fluxCpuShare(resources);
  const acceleration =
    overview === null
      ? null
      : describeAcceleration(overview.settings.hardwareAccel, overview.transcoder.hardwareAccels);
  const mediaDisk = libraryDisk(
    resources?.disks ?? [],
    libraries.map((library) => library.path),
  );

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex w-full flex-col gap-4 px-5 pb-6 pt-5 sm:px-10"
    >
      <Tabs value={panel} onValueChange={showPanel}>
        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
          className="flex justify-center"
        >
          <SectionBar
            groups={SECTIONS.map((section) => ({
              ...(section.label === null ? {} : { label: section.label }),
              items: section.items,
            }))}
            label="What to look at"
            value={panel}
            onValueChange={showPanel}
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
                  <RiCheckboxCircleLine size={16} className="text-accent" aria-hidden />
                ) : (
                  <RiAlertLine size={16} className="text-danger" aria-hidden />
                )}
                {overview === null
                  ? 'Reading the server…'
                  : overview.transcoder.isReachable
                    ? `Media service up · ${describeFfmpeg(overview.transcoder.ffmpegVersion)}`
                    : 'Media service unreachable'}
              </span>

              {acceleration === null ? null : (
                <HoverCard
                  side="bottom"
                  align="center"
                  detail={<p className="max-w-xs text-xs leading-relaxed">{acceleration.detail}</p>}
                >
                  <span>
                    <Badge size="sm" tone={acceleration.tone}>
                      {acceleration.label}
                    </Badge>
                  </span>
                </HoverCard>
              )}
            </p>
          </div>
        </motion.header>

        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
        >
          <ConcernsBanner
            concerns={collectConcerns({
              overview,
              monitor,
              libraries,
              sessions,
              history,
              encoderHistory,
            })}
            onOpenPanel={showPanel}
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
                    : `${resources.cpuCount.toString()} cores · Flux ${describeCpuShare(cpuShare)}`,
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
                label: 'Graphics',
                ...describeGraphics(resources?.graphics ?? null),
              },
              {
                label: 'Storage',
                value: mediaDisk === null ? '—' : `${formatBytes(mediaDisk.availableBytes)} free`,
                ...(mediaDisk === null
                  ? {}
                  : {
                      fraction:
                        (mediaDisk.totalBytes - mediaDisk.availableBytes) / mediaDisk.totalBytes,
                    }),
                detail:
                  mediaDisk === null
                    ? 'Not measured'
                    : `of ${formatBytes(mediaDisk.totalBytes)} · ${mediaDisk.mountPoint}`,
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
            <RiAlertLine size={18} className="shrink-0 text-danger" aria-hidden />
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
                onOpenPanel={showPanel}
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
                onMessage={tellViewer}
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
                schedulesTimezone={jobsTimezone}
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
                onHardwareAccelSaved={() => {
                  void fetchAdminOverview().then(setOverview);
                }}
              />
            </TabPanel>

            <TabPanel
              value="webhooks"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <WebhooksPanel
                webhooks={webhooks}
                created={createdWebhook}
                onCreate={async (webhook) => {
                  const { created, refusal } = await createWebhook(webhook);

                  if (refusal === null) {
                    setCreatedWebhook(created);
                    await reloadWebhooks();
                  }

                  return refusal;
                }}
                onDismissCreated={() => {
                  setCreatedWebhook(null);
                }}
                onSetEnabled={(id, enabled) => {
                  void setWebhookEnabled(id, enabled).then(reloadWebhooks);
                }}
                onDelete={(id) => {
                  void deleteWebhook(id).then(reloadWebhooks);
                }}
                onTest={(id) => {
                  void testWebhook(id);
                }}
                deliveries={deliveries}
                openHistoryId={openHistoryId}
                isHistoryLoading={isHistoryLoading}
                onOpenHistory={setOpenHistoryId}
                onRedeliver={(subscriptionId, deliveryId) => {
                  void redeliverWebhook(subscriptionId, deliveryId).then(() =>
                    reloadDeliveries(subscriptionId),
                  );
                }}
              />
            </TabPanel>

            <TabPanel
              value="logs"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <LogsPanel />
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
