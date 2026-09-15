import { Icon } from '@ValenceUI/Icon';
import { ArrowRight01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';
import { cn } from '@ValenceUI/cn';
import { BackgroundJobs } from '@ValenceScreens/components/AdminArea/components/BackgroundJobs/BackgroundJobs';
import { CacheBreakdown } from '@ValenceScreens/components/AdminArea/components/CacheBreakdown/CacheBreakdown';
import { TrendChart } from '@ValenceUI/TrendChart';
import { describeSince } from '@ValenceScreens/components/AdminArea/describeSince';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { describeQueueKind } from '@ValenceScreens/components/AdminArea/describeQueueKind';
import { describeAcceleration } from '@ValenceScreens/components/AdminArea/describeAcceleration';
import { describeChains } from '@ValenceScreens/components/AdminArea/describeChains';
import { describeToneMapping } from '@ValenceScreens/components/AdminArea/describeToneMapping';
import { describeCard } from '@ValenceScreens/components/AdminArea/describeCard';
import { memoryEnvelope } from '@ValenceScreens/components/AdminArea/memoryEnvelope';
import { measureStorage } from '@ValenceClient/admin/fetchAdmin';
import type { StorageCount } from '@ValenceClient/admin/fetchAdmin';
import type { OverviewPanelProps } from './OverviewPanel.types';

/**
 * One region of the dashboard: a heading, an optional action in its corner, and whatever the region
 * shows. Exists so that every region is the same shape and spacing without each rebuilding it.
 *
 * @param title - What the region is called.
 * @param action - What its corner control does, where it has one.
 * @param onAction - Called when that control is pressed.
 * @param actionIcon - The icon on that control.
 * @param isActionBusy - Whether that control's work is in flight.
 * @param isFlush - Whether what it shows runs to the card's edges, for a table.
 * @param children - What the region shows.
 * @param className - Anything extra the layout needs of it.
 */
const Region = ({
  title,
  action,
  onAction,
  actionIcon,
  isActionBusy = false,
  isFlush = false,
  children,
  className,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  isActionBusy?: boolean;
  isFlush?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <PanelCard
    title={title}
    isFlush={isFlush}
    className={cn('h-full', className)}
    {...(action === undefined || onAction === undefined
      ? {}
      : {
          actions: (
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-xs text-text-muted hover:text-text"
              onClick={onAction}
              disabled={isActionBusy}
              isLoading={isActionBusy}
            >
              {action}
              {actionIcon ?? <Icon of={ArrowRight01Icon} size={14} />}
            </Button>
          ),
        })}
  >
    <div className="mt-auto">{children}</div>
  </PanelCard>
);

Region.displayName = 'Region';

/**
 * The state of the server at a glance: what needs a person, what is being watched, what the machine
 * is doing, what the libraries hold, and what is on the disk. Everything here is a summary with a
 * way through to the panel that can act on it, so the dashboard answers "is anything wrong" without
 * trying to be the place anything is fixed.
 *
 * @param overview - What the server reports about itself, or null before it has answered.
 * @param monitor - The latest readings, or null before any have arrived.
 * @param libraries - The libraries configured.
 * @param sessions - What is being watched at the moment.
 * @param history - Recent processor readings, for the graph and for telling a spike from load.
 * @param onOpenPanel - Called with the panel to open.
 */
const OverviewPanel = ({
  overview,
  monitor,
  libraries,
  sessions,
  history,
  onOpenPanel,
}: OverviewPanelProps) => {
  const [counted, setCounted] = useState<StorageCount | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  const recount = async () => {
    setIsCounting(true);

    try {
      const measured = await measureStorage();

      if (measured !== null) {
        setCounted(measured);
      }
    } finally {
      setIsCounting(false);
    }
  };

  const acceleration =
    overview === null
      ? null
      : describeAcceleration(overview.settings.hardwareAccel, overview.transcoder.hardwareAccels);

  const chains = overview === null ? null : describeChains(overview.transcoder.chains);

  const toneMapping =
    overview === null
      ? null
      : describeToneMapping(overview.transcoder.toneMapping, overview.transcoder.hardwareToneMaps);

  const now = Date.now();
  const watching = sessions.filter((session) => session.playback !== null);
  const running = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'running');
  const waiting = monitor?.queue.queued ?? 0;
  const resources = monitor?.resources ?? null;
  const memory = memoryEnvelope(resources);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-4">
        <Region title="Load, last minute" className="lg:col-span-2">
          <TrendChart
            values={history}
            ceiling={100}
            label="Processor use over the last minute"
            caption={
              resources === null
                ? 'Waiting for the first reading.'
                : `Now ${Math.round(resources.systemCpuPercent).toString()}% · peak ${Math.round(
                    Math.max(0, ...history),
                  ).toString()}% · ${resources.cpuCount.toString()} processors · load ${resources.loadAverage.toFixed(2)}`
            }
          />
        </Region>

        <Region
          title="Server"
          className="lg:col-span-2"
          action="Settings"
          onAction={() => {
            onOpenPanel('settings');
          }}
        >
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">Media service</dt>
              <dd className="text-text">
                {overview === null ? '—' : overview.transcoder.isReachable ? 'Up' : 'Unreachable'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-text-muted">Hardware encoding</dt>
              <dd className="min-w-0 truncate text-text">{acceleration?.label ?? '—'}</dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-text-muted">Hardware chains</dt>
              <dd className="min-w-0 truncate text-text">{chains?.label ?? '—'}</dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-text-muted">HDR conversion</dt>
              <dd className="min-w-0 truncate text-text">{toneMapping?.label ?? '—'}</dd>
            </div>

            {toneMapping !== null && toneMapping.detail !== null && (
              <div className="flex flex-col gap-1">
                <dt className="text-text-muted">HDR conversion</dt>
                <dd className="text-xs text-text-muted">{toneMapping.detail}</dd>
              </div>
            )}

            {(chains?.refusals ?? []).length +
              (overview?.transcoder.rejectedEncoders ?? []).length >
            0 ? (
              <div className="valence-rail flex max-h-48 flex-col gap-3 overflow-y-auto">
                {(chains?.refusals ?? []).map((refusal) => (
                  <div key={refusal.id} className="flex flex-col gap-1">
                    <dt className="text-text-muted">{refusal.what}</dt>
                    <dd className="text-xs text-text-muted">{refusal.reason}</dd>
                  </div>
                ))}

                {(overview?.transcoder.rejectedEncoders ?? []).map((rejected) => (
                  <div key={rejected.encoder} className="flex flex-col gap-1">
                    <dt className="text-text-muted">{rejected.encoder} was not used</dt>
                    <dd className="text-xs text-text-muted">{rejected.reason}</dd>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-text-muted">Graphics</dt>
              <dd className="min-w-0 truncate text-text">
                {describeCard(resources?.graphics ?? null)}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">Processors</dt>
              <dd className="tabular-nums text-text">
                {resources === null ? '—' : resources.cpuCount.toString()}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">Memory</dt>
              <dd className="tabular-nums text-text">
                {memory === null
                  ? '—'
                  : `${formatBytes(memory.usedBytes)} of ${formatBytes(memory.totalBytes)}${
                      memory.isLimited ? ' allowed' : ''
                    }`}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-muted">Accounts</dt>
              <dd className="tabular-nums text-text">
                {(overview?.users ?? []).length.toString()}
              </dd>
            </div>
          </dl>
        </Region>

        <Region
          title="Watching now"
          action="All sessions"
          onAction={() => {
            onOpenPanel('activity');
          }}
        >
          {watching.length === 0 ? (
            <p className="text-sm text-text-muted">Nobody is watching anything.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
              {watching.map((session) => (
                <li key={session.clientId} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-text">
                      {session.playback?.mediaTitle ?? ''}
                    </span>
                    <span className="truncate text-xs text-text-muted">
                      {session.profileName ?? 'Unknown viewer'} · {session.deviceLabel}
                    </span>
                  </span>

                  <Badge size="sm" tone={session.playback?.mode === 'direct' ? 'quiet' : 'accent'}>
                    {session.playback?.mode === 'direct' ? 'Direct' : 'Transcode'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Region>

        <Region
          title="Running now"
          action="All jobs"
          onAction={() => {
            onOpenPanel('jobs');
          }}
        >
          {running.length === 0 ? (
            <p className="text-sm text-text-muted">
              {waiting === 0
                ? 'Nothing is running.'
                : `Nothing running, ${waiting.toString()} waiting.`}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
              {running.map((job) => (
                <li key={job.id} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-text">{job.subject}</span>
                    <span className="truncate text-xs text-text-muted">
                      {describeQueueKind(job.kind)}
                    </span>
                  </span>

                  <Badge size="sm" tone="accent">
                    running
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Region>

        <Region
          title="Libraries"
          className="lg:col-span-2"
          action="Manage"
          onAction={() => {
            onOpenPanel('libraries');
          }}
        >
          {libraries.length === 0 ? (
            <p className="text-sm text-text-muted">No libraries yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
              {libraries.map((library) => (
                <li key={library.id} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm text-text">
                      <span className="truncate">{library.name}</span>
                      <Badge size="sm">{library.kind}</Badge>
                    </span>
                    <span className="text-xs text-text-muted">
                      Scanned {describeSince(library.lastScannedAt, now)}
                    </span>
                  </span>

                  <span className="shrink-0 text-sm tabular-nums text-text-muted">
                    {library.itemCount === 1 ? '1 item' : `${library.itemCount.toString()} items`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Region>

        <Region
          title="Storage Valence is using"
          className="lg:col-span-4"
          action="Refresh"
          actionIcon={<Icon of={RefreshIcon} size={14} />}
          isActionBusy={isCounting}
          onAction={() => {
            void recount();
          }}
        >
          <CacheBreakdown
            cache={counted?.cache ?? monitor?.cache ?? null}
            artwork={counted?.artwork ?? overview?.artwork ?? null}
            liveSessions={monitor?.sessions ?? 0}
            library={
              overview === null
                ? null
                : {
                    bytes: counted?.libraryBytes ?? overview.library.bytes,
                    itemCount: overview.library.itemCount,
                  }
            }
          />
        </Region>

        <Region
          title="Recent jobs"
          action="All work"
          onAction={() => {
            onOpenPanel('jobs');
          }}
          isFlush
          className="lg:col-span-4"
        >
          <BackgroundJobs monitor={monitor} pageSize={5} />
        </Region>
      </div>
    </div>
  );
};

OverviewPanel.displayName = 'OverviewPanel';

export { OverviewPanel };
