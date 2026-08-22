import { Icon } from '@FluxUI/Icon';
import { Alert02Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
import { SharesPanel } from './components/SharesPanel/SharesPanel';
import {
  createWebhook,
  deleteWebhook,
  redeliverWebhook,
  setWebhookEnabled,
  testWebhook,
} from '@FluxClient/admin/fetchWebhooks';
import { AccountsPanel } from './components/AccountsPanel/AccountsPanel';
import { Tabs } from '@FluxUI/Tabs';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import {
  watchMonitor,
  watchActiveSessions,
  stopSession,
  pauseSession,
  messageSession,
  resumeSession,
  addJobTrigger,
  removeJobTrigger,
} from '@FluxClient/admin/fetchAdmin';
import { rebuildArtefacts } from '@FluxClient/library/fetchLibrary';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminQueries } from '@FluxClient/query/adminQueries';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { StatStrip } from './components/StatStrip/StatStrip';
import { ConcernsBanner } from './components/ConcernsBanner/ConcernsBanner';
import { collectConcerns } from './collectConcerns';
import { fluxCpuShare } from './fluxCpuShare';
import { fluxMemoryUse } from './fluxMemoryUse';
import { memoryEnvelope } from './memoryEnvelope';
import { libraryDisk } from './libraryDisk';
import { describeGraphics } from './describeGraphics';
import { describeCpuShare } from './describeCpuShare';
import { describeFluxMemory } from './describeFluxMemory';
import { describeFfmpeg } from './describeFfmpeg';
import { describeAcceleration } from './describeAcceleration';
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
import type { JobSchedules, ScheduleTrigger } from '@FluxClient/admin/fetchAdmin';
import type { CreatedWebhook } from '@FluxClient/admin/fetchWebhooks';
import type { AdminAreaProps } from './AdminArea.types';

const HISTORY_LENGTH = 60;

const SECTIONS = [
  { label: null, items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Activity',
    items: [
      { id: 'activity', label: 'Sessions' },
      { id: 'shares', label: 'Links' },
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
  const cache = useQueryClient();
  const [history, setHistory] = useState<number[]>([]);
  const [encoderHistory, setEncoderHistory] = useState<number[]>([]);
  const [panel, setPanel] = useState<PanelId>(
    () => PANELS.find((candidate) => candidate.id === initialPanel)?.id ?? 'overview',
  );
  const [viewingJobKind, setViewingJobKind] = useState<string | null>(initialJob ?? null);
  const [correcting, setCorrecting] = useState<MediaSummary | null>(null);
  const {
    progress: scanProgress,
    isScanningAll,
    isResettingAll,
  } = useSyncExternalStore(subscribeToScans, getScanSnapshot);
  const [createdWebhook, setCreatedWebhook] = useState<CreatedWebhook | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const askedOverview = useQuery(adminQueries.overview());
  const askedLibraries = useQuery(libraryQueries.all());
  const askedSessions = useQuery(adminQueries.sessions());
  const askedJobs = useQuery(adminQueries.jobs());
  const askedSchedules = useQuery(adminQueries.schedules());
  const askedMonitor = useQuery(adminQueries.monitor());

  const overview = askedOverview.data ?? null;
  const monitor = askedMonitor.data ?? null;

  const libraries = useMemo(() => askedLibraries.data ?? [], [askedLibraries.data]);

  const askedMedia = useQuery(adminQueries.everything(libraries.map((library) => library.id)));

  const media = askedMedia.data ?? [];
  const sessions = askedSessions.data ?? [];
  const jobDefinitions = useMemo(() => askedJobs.data ?? [], [askedJobs.data]);

  const jobSchedules = useMemo(
    () =>
      new Map((askedSchedules.data?.schedules ?? []).map((entry) => [entry.kind, entry.triggers])),
    [askedSchedules.data],
  );

  const jobsTimezone = askedSchedules.data?.timezone ?? null;

  const askedWebhooks = useQuery({
    ...adminQueries.webhooks(),
    enabled: panel === 'webhooks',
  });

  const webhooks = askedWebhooks.data ?? [];

  const askedDeliveries = useQuery(adminQueries.deliveries(openHistoryId));

  const deliveries = openHistoryId === null ? [] : (askedDeliveries.data ?? []);
  const isHistoryLoading = openHistoryId !== null && askedDeliveries.isPending;

  const unreachable = useMemo(() => {
    const readings = {
      overview: askedOverview.isError,
      media: askedMedia.isError,
      monitor: askedMonitor.isError,
      libraries: askedLibraries.isError,
      sessions: askedSessions.isError,
      jobs: askedJobs.isError,
      schedules: askedSchedules.isError,
    };

    return new Set(
      Object.entries(readings)
        .filter(([, failed]) => failed)
        .map(([name]) => name),
    );
  }, [
    askedOverview.isError,
    askedMedia.isError,
    askedMonitor.isError,
    askedLibraries.isError,
    askedSessions.isError,
    askedJobs.isError,
    askedSchedules.isError,
  ]);

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

  const loadAll = useCallback(async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: adminQueries.key }),
      cache.invalidateQueries({ queryKey: libraryQueries.key }),
    ]);
  }, [cache]);

  const reloadLibraries = useCallback(
    async () => cache.invalidateQueries({ queryKey: libraryQueries.all().queryKey }),
    [cache],
  );

  const reloadSessions = useCallback(
    async () => cache.invalidateQueries({ queryKey: adminQueries.sessions().queryKey }),
    [cache],
  );

  const onLibraryUpdated = (updated: Library) => {
    cache.setQueryData(libraryQueries.all().queryKey, (current: Library[] = []) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  };

  const onLibraryCreated = (library: Library) => {
    cache.setQueryData(libraryQueries.all().queryKey, (current: Library[] = []) => [
      ...current,
      library,
    ]);
  };

  const rescan = async (libraryId: string, force = false) => {
    await startScan(libraryId, force);
    await reloadLibraries();
  };

  const rescanAll = async () => {
    await startScanAll(libraries);
    await reloadLibraries();
  };

  const resetAll = async () => {
    await startResetAll(libraries);
    await reloadLibraries();
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

      await reloadLibraries();
    },
    [jobDefinitions, libraries],
  );

  const reloadSchedules = async () =>
    cache.invalidateQueries({ queryKey: adminQueries.schedules().queryKey });

  const addTrigger = async (kind: string, trigger: ScheduleTrigger) => {
    const added = await addJobTrigger(kind, trigger);

    if (added === null) {
      await reloadSchedules();

      return;
    }

    cache.setQueryData(adminQueries.schedules().queryKey, (current: JobSchedules | undefined) =>
      current === undefined
        ? current
        : {
            ...current,
            schedules: current.schedules.some((entry) => entry.kind === kind)
              ? current.schedules.map((entry) =>
                  entry.kind === kind ? { ...entry, triggers: [...entry.triggers, added] } : entry,
                )
              : [...current.schedules, { kind, triggers: [added] }],
          },
    );
  };

  const removeTrigger = async (kind: string, triggerId: string) => {
    cache.setQueryData(adminQueries.schedules().queryKey, (current: JobSchedules | undefined) =>
      current === undefined
        ? current
        : {
            ...current,
            schedules: current.schedules.map((entry) =>
              entry.kind === kind
                ? { ...entry, triggers: entry.triggers.filter((one) => one.id !== triggerId) }
                : entry,
            ),
          },
    );

    if (!(await removeJobTrigger(kind, triggerId))) {
      await reloadSchedules();
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
      await reloadSessions();
    } finally {
      setBusyClientId(null);
    }
  };

  const pauseStream = async (clientId: string) => {
    setBusyClientId(clientId);

    try {
      await pauseSession(clientId);
      await reloadSessions();
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
      await reloadSessions();
    } finally {
      setBusyClientId(null);
    }
  };

  useEffect(() => {
    void resumeRunning();
  }, []);

  const reloadWebhooks = useCallback(
    async () => cache.invalidateQueries({ queryKey: adminQueries.webhooks().queryKey }),
    [cache],
  );

  const reloadDeliveries = useCallback(
    async (id: string) =>
      cache.invalidateQueries({ queryKey: adminQueries.deliveries(id).queryKey }),
    [cache],
  );

  useEffect(
    () =>
      watchActiveSessions((found) => {
        cache.setQueryData(adminQueries.sessions().queryKey, found);
      }),
    [cache],
  );

  useEffect(() => {
    const stop = watchMonitor((reading) => {
      cache.setQueryData(adminQueries.monitor().queryKey, reading);
      setHistory((current) =>
        [...current, reading.resources.systemCpuPercent].slice(-historyLength),
      );
      setEncoderHistory((current) => {
        const encoder = reading.resources.graphics?.encoderPercent ?? null;

        return encoder === null ? [] : [...current, encoder].slice(-historyLength);
      });
    });

    return stop;
  }, [historyLength, cache]);

  const resources = monitor?.resources ?? null;
  const memory = memoryEnvelope(resources);
  const memoryFraction = memory === null ? 0 : memory.usedBytes / memory.totalBytes;
  const fluxMemory = fluxMemoryUse(resources);

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
                  <Icon of={CheckmarkCircle02Icon} size={16} className="text-accent" />
                ) : (
                  <Icon of={Alert02Icon} size={16} className="text-danger" />
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
                value: memory === null ? '—' : formatBytes(memory.usedBytes),
                fraction: memoryFraction,
                detail:
                  memory === null
                    ? '—'
                    : `of ${formatBytes(memory.totalBytes)}${memory.isLimited ? ' allowed' : ''} · Flux ${describeFluxMemory(fluxMemory)}`,
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
            className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-text"
          >
            <Icon of={Alert02Icon} size={18} className="shrink-0 text-danger" />
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
                  void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
                }}
                onHardwareAccelSaved={() => {
                  void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
                }}
              />
            </TabPanel>

            <TabPanel
              value="shares"
              render={
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              }
            >
              <SharesPanel />
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
            await cache.invalidateQueries({
              queryKey: adminQueries.everything(libraries.map((library) => library.id)).queryKey,
            });
          });
        }}
      />
    </motion.div>
  );
};

AdminArea.displayName = 'AdminArea';

export { AdminArea };
