import { Icon } from '@ValenceUI/Icon';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { TabPanel } from '@ValenceUI/TabPanel';
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
  changeWebhook,
  createWebhook,
  deleteWebhook,
  redeliverWebhook,
  setWebhookEnabled,
  testWebhook,
} from '@ValenceClient/admin/fetchWebhooks';
import { AccountsPanel } from './components/AccountsPanel/AccountsPanel';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import {
  watchMonitor,
  watchActiveSessions,
  stopSession,
  pauseSession,
  messageSession,
  resumeSession,
  addJobTrigger,
  removeJobTrigger,
} from '@ValenceClient/admin/fetchAdmin';
import { rebuildArtefacts } from '@ValenceClient/library/fetchLibrary';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminQueries } from '@ValenceClient/query/adminQueries';
import { profileQueries } from '@ValenceClient/query/profileQueries';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { StatStrip } from './components/StatStrip/StatStrip';
import { ConcernsBanner } from './components/ConcernsBanner/ConcernsBanner';
import { collectConcerns } from './collectConcerns';
import { valenceCpuShare } from './valenceCpuShare';
import { valenceMemoryUse } from './valenceMemoryUse';
import { memoryEnvelope } from './memoryEnvelope';
import { libraryDisk } from './libraryDisk';
import { describeGraphics } from './describeGraphics';
import { describeCpuShare } from './describeCpuShare';
import { describeValenceMemory } from './describeValenceMemory';
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
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import type { Library, MediaSummary } from '@ValenceContracts/schemas/Library';
import type { JobSchedules, ScheduleTrigger } from '@ValenceClient/admin/fetchAdmin';
import type { CreatedWebhook } from '@ValenceClient/admin/fetchWebhooks';
import { useTravelDirection } from '@ValenceUI/useTravelDirection';
import { ADMIN_PANELS } from '@ValenceScreens/components/AdminArea/adminSections';
import type { AdminAreaProps } from './AdminArea.types';

const HISTORY_LENGTH = 60;

const PANEL_ORDER = ADMIN_PANELS.map((one) => one.id);

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
 * @param panel - Which panel is open, which the dialog around this holds.
 * @param onPanel - Told which panel to open.
 * @param initialJob - The job whose schedule to open, where the address named one.
 * @param onJobChange - Called with the job whose schedule was opened, or null on going back.
 */
const AdminArea = ({
  historyLength = HISTORY_LENGTH,
  panel,
  onPanel,
  initialJob,
  onJobChange,
}: AdminAreaProps) => {
  const cache = useQueryClient();
  const [history, setHistory] = useState<number[]>([]);
  const [encoderHistory, setEncoderHistory] = useState<number[]>([]);
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
  const travel = useTravelDirection(PANEL_ORDER, panel);

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

  const askedWebhookAccounts = useQuery({
    ...adminQueries.accounts(),
    enabled: panel === 'webhooks',
  });

  const askedWebhookProfiles = useQuery({
    ...profileQueries.everyone(),
    enabled: panel === 'webhooks',
  });

  const webhookAccounts = useMemo(
    () => (askedWebhookAccounts.data ?? []).map((one) => ({ id: one.id, label: one.name })),
    [askedWebhookAccounts.data],
  );

  const webhookProfiles = useMemo(
    () => (askedWebhookProfiles.data ?? []).map((one) => ({ id: one.id, label: one.name })),
    [askedWebhookProfiles.data],
  );

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
      const found = ADMIN_PANELS.find((candidate) => candidate.id === next);

      if (found === undefined) {
        return;
      }

      onPanel(found.id);
      setViewingJobKind(null);
      onJobChange?.(null);
    },
    [onPanel, onJobChange],
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

  const onLibraryDeleted = (libraryId: string) => {
    cache.setQueryData(libraryQueries.all().queryKey, (current: Library[] = []) =>
      current.filter((entry) => entry.id !== libraryId),
    );
    void cache.invalidateQueries({ queryKey: libraryQueries.key });
    void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
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
  const valenceMemory = valenceMemoryUse(resources);

  const conversions = resources?.children ?? [];
  const cpuShare = valenceCpuShare(resources);
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
      className="flex w-full flex-col gap-5 pb-2"
    >
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
                  : `${resources.cpuCount.toString()} cores · Valence ${describeCpuShare(cpuShare)}`,
            },
            {
              label: 'Memory',
              value: memory === null ? '—' : formatBytes(memory.usedBytes),
              fraction: memoryFraction,
              detail:
                memory === null
                  ? '—'
                  : `of ${formatBytes(memory.totalBytes)}${memory.isLimited ? ' allowed' : ''} · Valence ${describeValenceMemory(valenceMemory)}`,
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
          className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 font-body text-sm text-text"
        >
          <Icon of={Alert02Icon} size={18} className="shrink-0 text-danger" />
          Some of this could not be read from the server, so parts of the page may be missing rather
          than empty.
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
          <TabPanel value="overview" travel={travel}>
            <OverviewPanel
              overview={overview}
              monitor={monitor}
              libraries={libraries}
              sessions={sessions}
              history={history}
              onOpenPanel={showPanel}
            />
          </TabPanel>

          <TabPanel value="activity" travel={travel}>
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

          <TabPanel value="jobs" travel={travel}>
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

          <TabPanel value="libraries" travel={travel}>
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
              onLibraryDeleted={onLibraryDeleted}
            />
          </TabPanel>

          <TabPanel value="media" travel={travel}>
            <MediaPanel
              isUnreachable={unreachable.has('media')}
              media={media}
              onCorrect={setCorrecting}
              onRebuildArtefacts={async (item) => (await rebuildArtefacts(item.id)) !== null}
            />
          </TabPanel>

          <TabPanel value="accounts" travel={travel}>
            <AccountsPanel />
          </TabPanel>

          <TabPanel value="roles" travel={travel}>
            <RolesPanel />
          </TabPanel>

          <TabPanel value="settings" travel={travel}>
            <SettingsPanel
              overview={overview}
              onCatalogueKeySaved={() => {
                void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
              }}
              onHardwareAccelSaved={() => {
                void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
              }}
              onPreviewQualitySaved={() => {
                void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
              }}
              onProfileVisibilitySaved={() => {
                void cache.invalidateQueries({ queryKey: adminQueries.overview().queryKey });
              }}
            />
          </TabPanel>

          <TabPanel value="shares" travel={travel}>
            <SharesPanel />
          </TabPanel>

          <TabPanel value="webhooks" travel={travel}>
            <WebhooksPanel
              webhooks={webhooks}
              accounts={webhookAccounts}
              profiles={webhookProfiles}
              created={createdWebhook}
              onCreate={async (webhook) => {
                const { created, refusal } = await createWebhook(webhook);

                if (refusal === null) {
                  setCreatedWebhook(created);
                  await reloadWebhooks();
                }

                return refusal;
              }}
              onEdit={async (id, change) => {
                const refusal = await changeWebhook(id, change);

                if (refusal === null) {
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

          <TabPanel value="logs" travel={travel}>
            <LogsPanel />
          </TabPanel>
        </section>
      </motion.div>

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
