import type { ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { cn } from '@FluxUI/cn';
import { CardHeader } from '@FluxUI/CardHeader';
import { BackgroundJobs } from '@FluxWeb/components/AdminArea/components/BackgroundJobs/BackgroundJobs';
import { TrendChart } from '@FluxUI/TrendChart';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import { formatBytes } from '@FluxWeb/components/AdminArea/formatBytes';
import { describeQueueKind } from '@FluxWeb/components/AdminArea/describeQueueKind';
import type { OverviewPanelProps } from './OverviewPanel.types';

/**
 * One region of the dashboard.
 *
 * Every region is the same shape — a heading, a way through to the panel that
 * owns it, and either content or a sentence saying why there is none. A region
 * that disappears when it has nothing to show leaves a hole in the grid and
 * makes a working server look broken.
 *
 * The surface itself comes from `Card`, which is where every panel in Flux
 * gets its rounding, hairline and shadow. This decides only what goes in one.
 *
 * The heading sits at the top and the contents at the foot, so regions of
 * different heights in one row still line their contents up along the bottom
 * rather than each floating wherever its own length puts it.
 */
const Region = ({
  title,
  action,
  onAction,
  children,
  className,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}) => (
  <Card as="section" padding="md" className={cn('flex h-full flex-col gap-4', className)}>
    <header className="flex items-baseline justify-between gap-3">
      <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">{title}</h3>

      {action === undefined || onAction === undefined ? null : (
        <Button
          variant="ghost"
          size="sm"
          isPill
          className="shrink-0 text-xs text-text-muted hover:text-text"
          onClick={onAction}
        >
          {action}
          <IconChevronRight size={14} aria-hidden />
        </Button>
      )}
    </header>

    <div className="mt-auto">{children}</div>
  </Card>
);

Region.displayName = 'Region';

/**
 * The state of the server at a glance.
 *
 * Answers the two questions somebody opens this page with: is anything wrong,
 * and what is it doing. The second matters as much as the first — a dashboard
 * that is blank when all is well tells an operator nothing, and a server with
 * four people watching and a scan running is not the same as an idle one even
 * though neither has a fault.
 *
 * Everything here is already fetched for some other panel. What is new is that
 * it is in one place, so answering "is everything all right" no longer means
 * visiting four sections and assembling it.
 */
const OverviewPanel = ({
  overview,
  monitor,
  libraries,
  sessions,
  history,
  onOpenPanel,
}: OverviewPanelProps) => {
  const now = Date.now();
  const watching = sessions.filter((session) => session.playback !== null);
  const running = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'running');
  const waiting = monitor?.queue.queued ?? 0;
  const resources = monitor?.resources ?? null;

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
              <dd className="min-w-0 truncate text-text">
                {(overview?.transcoder.hardwareAccels ?? []).length === 0
                  ? 'None'
                  : (overview?.transcoder.hardwareAccels ?? []).join(', ')}
              </dd>
            </div>

            {(overview?.transcoder.rejectedEncoders ?? []).map((rejected) => (
              <div key={rejected.encoder} className="flex flex-col gap-1">
                <dt className="text-text-muted">{rejected.encoder} was not used</dt>
                <dd className="text-xs text-text-muted">{rejected.reason}</dd>
              </div>
            ))}

            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-text-muted">Graphics</dt>
              <dd className="min-w-0 truncate text-text">
                {resources?.graphics === null || resources?.graphics === undefined
                  ? 'None Flux can read'
                  : resources.graphics.encoderPercent === null
                    ? `${resources.graphics.name} · encoder not readable`
                    : resources.graphics.name}
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
                {resources === null
                  ? '—'
                  : `${formatBytes(resources.systemMemoryUsedBytes)} of ${formatBytes(
                      resources.systemMemoryTotalBytes,
                    )}`}
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

        <Card as="section" padding="none" className="flex flex-col overflow-hidden lg:col-span-4">
          <CardHeader title="Work">
            <Button
              variant="ghost"
              size="sm"
              isPill
              className="text-xs text-text-muted hover:text-text"
              onClick={() => {
                onOpenPanel('jobs');
              }}
            >
              All work
              <IconChevronRight size={14} aria-hidden />
            </Button>
          </CardHeader>

          <BackgroundJobs monitor={monitor} pageSize={5} />
        </Card>
      </div>
    </div>
  );
};

OverviewPanel.displayName = 'OverviewPanel';

export { OverviewPanel };
