import { useMemo } from 'react';
import { CardHeader } from '@FluxUI/CardHeader';
import { BackgroundJobs } from '@FluxWeb/components/AdminArea/components/BackgroundJobs/BackgroundJobs';
import { Card } from '@FluxUI/Card';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { JobRunner } from '@FluxWeb/components/AdminArea/components/JobRunner/JobRunner';
import { JobSchedulePage } from '@FluxWeb/components/AdminArea/components/JobSchedulePage/JobSchedulePage';
import type { JobsPanelProps } from './JobsPanel.types';

/**
 * What can be started by hand, and what is running because something started it earlier.
 */
const JobsPanel = ({
  isUnreachable = false,
  definitions,
  libraries,
  progress,
  monitor,
  viewingJobKind,
  schedules,
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
              />
            </DialogContent>

            <DialogFooter>
              <Button variant="secondary" isPill onClick={onCloseSchedule}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      <Card as="section" padding="none" className="flex flex-col overflow-hidden">
        <CardHeader title="Background jobs">
          <span className="text-xs text-text-muted">
            {monitor === null
              ? '—'
              : `${monitor.queue.running.toString()} running · ${monitor.queue.queued.toString()} waiting · ${monitor.queue.concurrency.toString()} at a time${
                  failures === 0 ? '' : ` · ${failures.toString()} failed`
                }`}
          </span>
        </CardHeader>

        <BackgroundJobs monitor={monitor} isUnreachable={isUnreachable} pageSize={10} />
      </Card>

      <Card as="section" padding="none" className="flex flex-col overflow-hidden">
        <CardHeader title="Server jobs" />

        <JobRunner
          working={working}
          definitions={definitions}
          libraries={libraries}
          progress={progress}
          onRun={onRun}
          onStop={onStop}
          onOpenSchedule={onOpenSchedule}
        />
      </Card>
    </div>
  );
};

JobsPanel.displayName = 'JobsPanel';

export { JobsPanel };
