import { useCallback, useMemo, useRef, useState } from 'react';
import { IconCalendarClock, IconDots, IconInfoCircle, IconPlayerPlay } from '@tabler/icons-react';
import { ActionMenu } from '@FluxUI/ActionMenu';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { DataTable } from '@FluxUI/DataTable';
import { HoverCard } from '@FluxUI/HoverCard';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { ScanProgressBar } from '@FluxWeb/components/AdminArea/components/ScanProgressBar/ScanProgressBar';
import { summariseProgress } from './summariseProgress';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { JobDefinition } from '@FluxWeb/admin/fetchAdmin';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';
import type { JobRunnerProps } from './JobRunner.types';

/**
 * How many of the files a job is working through are worth naming.
 */
const WORKING_SHOWN = 4;

/**
 * What each job kind puts on the media service's queue.
 *
 * The queue names work rather than jobs — "preview", "thumbnails" — because
 * that is what it is doing, so a job has to be translated into the work it
 * causes to say which file it is on. A scan causes all of it, which is why it
 * is absent here: anything running belongs to it.
 */
const QUEUED_AS: Record<string, string[]> = {
  'library.regeneratePreviews': ['preview'],
  'library.regenerateTrickplay': ['thumbnails', 'trickplay'],
  'library.detectSegments': ['fingerprint'],
};

/**
 * Lets an admin start any job on demand, or press into it to see how often
 * it runs on its own — Jellyfin's scheduled-tasks page style.
 *
 * Reads from the same `scanCoordinator` progress map the Libraries panel's
 * own scan buttons use, so a job started here shows up there too, and a job
 * already running disables its own row rather than letting an operator
 * queue a second one. A job that does not need a library is tracked under
 * its own kind instead — see `scanCoordinator.runDefinedJob`.
 */
const JobRunner = ({
  definitions,
  libraries,
  progress,
  working,
  onRun,
  onOpenSchedule,
}: JobRunnerProps) => {
  const [confirming, setConfirming] = useState<JobDefinition | null>(null);

  /**
   * Everything running under one job kind, folded into the one bar its row
   * shows.
   *
   * A library-scoped job is tracked per library and a server-wide one under
   * its own kind, so both are gathered here — an operator pressing Run once
   * expects one answer about it, not a bar for every library it happened to
   * fan out across.
   */
  const summaryFor = useCallback(
    (kind: string) =>
      summariseProgress(
        [...libraries.map((library) => progress.get(library.id)), progress.get(kind)].filter(
          (entry): entry is ScanEntry => entry?.kind === kind,
        ),
      ),
    [libraries, progress],
  );

  const askOrRun = useCallback(
    (definition: JobDefinition) => {
      if (definition.destructive) {
        setConfirming(definition);

        return;
      }

      onRun(definition.kind);
    },
    [onRun],
  );

  /**
   * The live figures, reachable from a column without being part of it.
   *
   * Columns are built once and never again: a column rebuilt is a new `cell`
   * function, which React treats as a different component and remounts —
   * closing the very hover card these figures are for. The table re-renders on
   * its own every time a reading arrives, and each cell reads whatever is in
   * here at that moment.
   */
  const isBusy = definitions.some((definition) => summaryFor(definition.kind) !== null);

  const live = useRef({ summaryFor, working, askOrRun, onOpenSchedule, isBusy });

  live.current = { summaryFor, working, askOrRun, onOpenSchedule, isBusy };

  const columns = useMemo<DataTableColumn<JobDefinition>[]>(
    () => [
      {
        id: 'job',
        header: 'Job',
        accessorFn: (definition) => definition.label,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-text">{row.original.label}</span>
            <span className="text-xs text-text-muted">{row.original.description}</span>
          </span>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        accessorFn: (definition) => (definition.needsLibrary ? 'Libraries' : 'Server'),
        cell: ({ row }) => (
          <Badge size="sm" tone={row.original.needsLibrary ? 'quiet' : 'accent'}>
            {row.original.needsLibrary ? 'Libraries' : 'Server'}
          </Badge>
        ),
      },
      {
        id: 'state',
        header: 'State',
        enableSorting: false,
        cell: ({ row }) => {
          const summary = live.current.summaryFor(row.original.kind);

          if (summary === null) {
            return (
              <Badge size="sm" tone="quiet">
                Idle
              </Badge>
            );
          }

          const causes = QUEUED_AS[row.original.kind];

          const onNow = live.current.working.filter(
            (job) => job.state === 'running' && (causes === undefined || causes.includes(job.kind)),
          );

          return (
            <HoverCard
              side="left"
              align="center"
              detail={
                <div className="flex flex-col gap-3">
                  <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
                    {row.original.label}
                  </span>

                  <ScanProgressBar
                    label={row.original.label}
                    phase={summary.phase}
                    processed={summary.processed}
                    total={summary.total}
                  />

                  {onNow.length === 0 ? (
                    <p className="font-body text-xs text-text-muted">
                      Nothing on the queue yet — it is still working out what there is to do.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {onNow.slice(0, WORKING_SHOWN).map((job) => (
                        <li key={job.id} className="flex min-w-0 flex-col">
                          <span className="truncate text-xs text-text" title={job.subject}>
                            {job.subject}
                          </span>
                          <span className="text-xs text-text-muted">{job.kind}</span>
                        </li>
                      ))}

                      {onNow.length <= WORKING_SHOWN ? null : (
                        <li className="font-body text-xs text-text-muted">
                          and {(onNow.length - WORKING_SHOWN).toString()} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              }
            >
              <Badge size="sm" tone="accent">
                Running
              </Badge>

              <IconInfoCircle size={15} className="shrink-0 text-text-muted" aria-hidden />
            </HoverCard>
          );
        },
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end">
            <ActionMenu
              label={`Actions for ${row.original.label}`}
              trigger={<IconDots size={16} aria-hidden />}
              groups={[
                {
                  items: [
                    {
                      id: 'run',
                      label: 'Run now',
                      icon: <IconPlayerPlay size={15} aria-hidden />,
                      isDestructive: row.original.destructive,
                      isDisabled:
                        live.current.isBusy && live.current.summaryFor(row.original.kind) === null,
                      onChoose: () => {
                        live.current.askOrRun(row.original);
                      },
                    },
                    {
                      id: 'schedule',
                      label: 'Edit schedule',
                      icon: <IconCalendarClock size={15} aria-hidden />,
                      onChoose: () => {
                        live.current.onOpenSchedule(row.original.kind);
                      },
                    },
                  ],
                },
              ]}
            />
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable label="Server jobs" columns={columns} rows={definitions} />

      <Dialog
        label={confirming === null ? 'Run this job?' : `Run ${confirming.label}?`}
        isOpen={confirming !== null}
        onClose={() => {
          setConfirming(null);
        }}
      >
        {confirming === null ? null : (
          <>
            <DialogTitle title={`${confirming.label}?`} />

            <DialogContent>
              <p className="text-sm text-text-muted">
                {confirming.description} This cannot be undone.
              </p>
            </DialogContent>

            <DialogFooter>
              <Button
                variant="secondary"
                isPill
                onClick={() => {
                  setConfirming(null);
                }}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                isPill
                onClick={() => {
                  onRun(confirming.kind);
                  setConfirming(null);
                }}
              >
                {confirming.label}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </>
  );
};

JobRunner.displayName = 'JobRunner';

export { JobRunner };
