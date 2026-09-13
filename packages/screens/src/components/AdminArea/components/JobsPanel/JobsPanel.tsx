import { useMemo } from 'react';
import { BackgroundJobs } from '@ValenceScreens/components/AdminArea/components/BackgroundJobs/BackgroundJobs';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { JobRunner } from '@ValenceScreens/components/AdminArea/components/JobRunner/JobRunner';
import { JobSchedulePage } from '@ValenceScreens/components/AdminArea/components/JobSchedulePage/JobSchedulePage';
import type { JobsPanelProps } from './JobsPanel.types';
import { PanelCard } from '@ValenceScreens/components/PanelCard/PanelCard';

/**
 * The Work tab: what can be started by hand, what is running because something started it earlier,
 * and what each job's schedule is. Holds no state of its own — which job's schedule is open is
 * decided above it, so that opening one is a place the browser can return to.
 *
 * @param isUnreachable - Whether the service is not answering.
 * @param definitions - The jobs the server offers.
 * @param libraries - The libraries a job can be run against.
 * @param progress - What is running now, by library.
 * @param monitor - The latest readings, or null before any have arrived.
 * @param viewingJobKind - The job whose schedule is open, if any.
 * @param schedules - What makes each job run on its own.
 * @param onRun - Called with the job to start.
 * @param onStop - Called with the job to stop.
 * @param onOpenSchedule - Called with the job whose schedule is to be opened.
 * @param onCloseSchedule - Called on going back to the list.
 * @param onAddTrigger - Called with a job and a trigger to add to it.
 * @param onRemoveTrigger - Called with a job and the trigger to remove from it.
 */
const JobsPanel = ({
  isUnreachable = false,
  definitions,
  libraries,
  progress,
  monitor,
  viewingJobKind,
  schedules,
  schedulesTimezone = null,
  onRun,
  onStop,
  onOpenSchedule,
  onCloseSchedule,
  onAddTrigger,
  onRemoveTrigger,
}: JobsPanelProps) => {
  const working = useMemo(() => monitor?.queue.jobs ?? [], [monitor]);
  const failures = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'failed').length;
  const viewing =
    viewingJobKind === null
      ? null
      : (definitions.find((definition) => definition.kind === viewingJobKind) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <Dialog
        label={viewing?.label ?? 'Schedule'}
        isOpen={viewing !== null}
        onClose={onCloseSchedule}
      >
        {viewing === null ? null : (
          <>
            <DialogTitle title={viewing.label} detail={viewing.description} />

            <DialogContent>
              <JobSchedulePage
                triggers={schedules.get(viewing.kind) ?? []}
                onAdd={(trigger) => {
                  onAddTrigger(viewing.kind, trigger);
                }}
                onRemove={(triggerId) => {
                  onRemoveTrigger(viewing.kind, triggerId);
                }}
                timezone={schedulesTimezone}
              />
            </DialogContent>

            <DialogFooter>
              <Button variant="secondary" onClick={onCloseSchedule}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      <PanelCard
        title="Background jobs"
        isFlush
        actions={
          <span className="text-xs text-text-muted">
            {monitor === null
              ? '—'
              : `${monitor.queue.running.toString()} running · ${monitor.queue.queued.toString()} waiting · ${monitor.queue.concurrency.toString()} at a time${
                  failures === 0 ? '' : ` · ${failures.toString()} failed`
                }`}
          </span>
        }
      >
        <BackgroundJobs monitor={monitor} isUnreachable={isUnreachable} pageSize={10} />
      </PanelCard>

      <PanelCard title="Run a job" isFlush>
        <JobRunner
          working={working}
          definitions={definitions}
          libraries={libraries}
          progress={progress}
          onRun={onRun}
          onStop={onStop}
          onOpenSchedule={onOpenSchedule}
        />
      </PanelCard>
    </div>
  );
};

JobsPanel.displayName = 'JobsPanel';

export { JobsPanel };
