import { Badge } from '@FluxUI/Badge';
import { JobRunner } from '@FluxWeb/components/AdminArea/components/JobRunner/JobRunner';
import { JobSchedulePage } from '@FluxWeb/components/AdminArea/components/JobSchedulePage/JobSchedulePage';
import type { Job } from '@FluxWeb/admin/fetchAdmin';
import type { JobsPanelProps } from './JobsPanel.types';

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

/**
 * What can be started by hand, and what is running because something started
 * it earlier.
 *
 * One panel with two halves rather than two, because the question "why is the
 * box busy" is usually answered by something somebody pressed a minute ago.
 *
 * Opening a job's schedule replaces the whole panel instead of sitting beside
 * it: a list of triggers is a page of its own, and showing both at once leaves
 * neither enough room.
 */
const JobsPanel = ({
  definitions,
  libraries,
  progress,
  monitor,
  viewingJobKind,
  schedules,
  onRun,
  onOpenSchedule,
  onCloseSchedule,
  onAddTrigger,
  onRemoveTrigger,
}: JobsPanelProps) => {
  const now = Date.now();
  const failures = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'failed').length;
  const viewing =
    viewingJobKind === null
      ? null
      : (definitions.find((definition) => definition.kind === viewingJobKind) ?? null);

  return (
    <div className="flex flex-col">
      {viewing !== null ? (
        <JobSchedulePage
          definition={viewing}
          triggers={schedules.get(viewing.kind) ?? []}
          onAdd={(trigger) => {
            onAddTrigger(viewing.kind, trigger);
          }}
          onRemove={(triggerId) => {
            onRemoveTrigger(viewing.kind, triggerId);
          }}
          onClose={onCloseSchedule}
        />
      ) : (
        <>
          <header className="border-b border-white/10 px-6 py-4">
            <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Server Jobs</h2>
          </header>

          <JobRunner
            definitions={definitions}
            libraries={libraries}
            progress={progress}
            onRun={onRun}
            onOpenSchedule={onOpenSchedule}
          />

          <header className="flex flex-wrap items-baseline justify-between gap-3 border-y border-white/10 px-6 py-4">
            <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Background work</h2>

            <span className="text-xs text-text-muted">
              {monitor === null
                ? '—'
                : `${monitor.queue.running.toString()} running · ${monitor.queue.queued.toString()} waiting · ${monitor.queue.concurrency.toString()} at a time${
                    failures === 0 ? '' : ` · ${failures.toString()} failed`
                  }`}
            </span>
          </header>

          {monitor === null || monitor.queue.jobs.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">Nothing queued.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
              {monitor.queue.jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-4 px-6 py-3 text-sm">
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
  );
};

JobsPanel.displayName = 'JobsPanel';

export { JobsPanel };
