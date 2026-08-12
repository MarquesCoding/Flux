import type { ReactNode } from 'react';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { collectConcerns } from '@FluxWeb/components/AdminArea/collectConcerns';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import { formatBytes } from '@FluxWeb/components/AdminArea/formatBytes';
import type { ConcernTone } from '@FluxWeb/components/AdminArea/collectConcerns';
import type { OverviewPanelProps } from './OverviewPanel.types';

/**
 * Three levels, drawn from the tokens that exist.
 *
 * There is no warning colour in the palette, and inventing one here would be
 * a design decision smuggled into a refactor. Full-strength text against
 * muted is enough to separate "needs a person" from "not finished setting
 * up", and only what is actually broken takes the danger colour.
 */
const TONE_CLASSES: Record<ConcernTone, string> = {
  broken: 'text-danger',
  attention: 'text-text',
  setup: 'text-text-muted',
};

/**
 * One region of the dashboard.
 *
 * Every card is the same shape — a heading, a way through to the panel that
 * owns it, and either content or a sentence saying why there is none. A card
 * that disappears when it has nothing to show leaves a hole in the grid and
 * makes a working server look broken.
 */
const Card = ({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface/40 p-6">
    <header className="flex items-baseline justify-between gap-3">
      <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">{title}</h3>

      {action === undefined || onAction === undefined ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto shrink-0 rounded-none bg-transparent p-0 text-xs text-text-muted hover:bg-transparent hover:text-text"
          onClick={onAction}
        >
          {action}
          <IconChevronRight size={14} aria-hidden />
        </Button>
      )}
    </header>

    {children}
  </section>
);

Card.displayName = 'Card';

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
  onOpenPanel,
}: OverviewPanelProps) => {
  const now = Date.now();
  const concerns = collectConcerns({ overview, monitor, libraries });
  const watching = sessions.filter((session) => session.playback !== null);
  const running = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'running');
  const waiting = monitor?.queue.queued ?? 0;
  const resources = monitor?.resources ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card title="Needs attention">
        {concerns.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-text">
            <IconCircleCheck size={16} className="shrink-0 text-accent" aria-hidden />
            Nothing needs attention.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {concerns.map((concern) => (
              <li key={concern.id}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-left"
                  onClick={() => {
                    onOpenPanel(concern.panel);
                  }}
                >
                  <span className={`mt-0.5 shrink-0 ${TONE_CLASSES[concern.tone]}`}>
                    {concern.tone === 'setup' ? (
                      <IconInfoCircle size={16} aria-hidden />
                    ) : (
                      <IconAlertTriangle size={16} aria-hidden />
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm text-text">{concern.title}</span>
                    <span className="truncate text-xs text-text-muted">{concern.detail}</span>
                  </span>

                  <IconChevronRight size={14} className="shrink-0 text-text-muted" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Watching now"
          action="All sessions"
          onAction={() => {
            onOpenPanel('activity');
          }}
        >
          {watching.length === 0 ? (
            <p className="text-sm text-text-muted">Nobody is watching anything.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5">
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
        </Card>

        <Card
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
            <ul className="flex flex-col divide-y divide-white/5">
              {running.map((job) => (
                <li key={job.id} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-text">{job.subject}</span>
                    <span className="truncate text-xs text-text-muted">{job.kind}</span>
                  </span>

                  <Badge size="sm" tone="accent">
                    running
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Libraries"
          action="Manage"
          onAction={() => {
            onOpenPanel('libraries');
          }}
        >
          {libraries.length === 0 ? (
            <p className="text-sm text-text-muted">No libraries yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5">
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
        </Card>

        <Card
          title="Server"
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
        </Card>
      </div>
    </div>
  );
};

OverviewPanel.displayName = 'OverviewPanel';

export { OverviewPanel };
