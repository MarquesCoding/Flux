import { useMemo, useRef } from 'react';
import { Badge } from '@FluxUI/Badge';
import { DataTable } from '@FluxUI/DataTable';
import { describeElapsed } from '@FluxWeb/components/AdminArea/describeElapsed';
import { describeQueueKind } from '@FluxWeb/components/AdminArea/describeQueueKind';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Job } from '@FluxWeb/admin/fetchAdmin';
import type { BackgroundJobsProps } from './BackgroundJobs.types';

/**
 * What the queue is saying, as one string.
 *
 * The reading arrives over a stream a second, and its job list is parsed
 * afresh each time — so an untouched queue still hands the table a brand new
 * array every second, and the table rebuilds around whatever is open in it.
 * Comparing what the rows say lets an unchanged queue keep the array it had.
 */
const describeQueue = (jobs: Job[]): string =>
  jobs
    .map(
      (job) =>
        `${job.id}:${job.state}:${String(job.startedAtMs)}:${String(job.finishedAtMs)}:${job.detail ?? ''}`,
    )
    .join('|');

/**
 * The empty list, held once.
 *
 * A fresh `[]` every render is a new set of rows to the table, which rebuilds
 * around anything open in it. The monitor pushes a reading a second, so this
 * matters more than it looks.
 */
const NOTHING_QUEUED: Job[] = [];

const JOB_TONES: Record<Job['state'], 'quiet' | 'accent' | 'solid'> = {
  queued: 'quiet',
  running: 'accent',
  finished: 'quiet',
  failed: 'solid',
};

/**
 * What the queue has been doing, as one table.
 *
 * Shared by the jobs section and the overview rather than written twice: the
 * overview's version differed by a page size, which is not a reason for two
 * tables that then drift apart a column at a time.
 */
const BackgroundJobs = ({ monitor, isUnreachable = false, pageSize }: BackgroundJobsProps) => {
  const arrived = monitor?.queue.jobs ?? NOTHING_QUEUED;
  const saying = describeQueue(arrived);
  const held = useRef(arrived);
  const saidRef = useRef(saying);

  if (saidRef.current !== saying) {
    held.current = arrived;
    saidRef.current = saying;
  }

  const rows = held.current;

  const columns = useMemo<DataTableColumn<Job>[]>(
    () => [
      {
        id: 'state',
        header: 'State',
        accessorFn: (job) => job.state,
        cell: ({ row }) => (
          <Badge size="sm" tone={JOB_TONES[row.original.state]}>
            {row.original.state}
          </Badge>
        ),
      },
      {
        id: 'kind',
        header: 'Job',
        accessorFn: (job) => describeQueueKind(job.kind),
        cell: ({ row }) => (
          <span className="text-text-muted">{describeQueueKind(row.original.kind)}</span>
        ),
      },
      {
        id: 'subject',
        header: 'Subject',
        accessorFn: (job) => job.subject,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-text" title={row.original.subject}>
              {row.original.subject}
            </span>

            {row.original.detail === null ? null : (
              <span className="truncate text-xs text-danger">{row.original.detail}</span>
            )}
          </span>
        ),
      },
      {
        id: 'finished',
        header: 'Finished',
        accessorFn: (job) => job.finishedAtMs ?? 0,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-text-muted">
            {row.original.finishedAtMs === null
              ? row.original.startedAtMs === null
                ? 'waiting'
                : 'running'
              : new Date(row.original.finishedAtMs).toLocaleTimeString()}
          </span>
        ),
      },
      {
        id: 'took',
        header: 'Took',
        accessorFn: (job) => (job.finishedAtMs ?? Date.now()) - (job.startedAtMs ?? Date.now()),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-text-muted">
            {describeElapsed(row.original, Date.now())}
          </span>
        ),
      },
    ],
    [],
  );

  if (isUnreachable) {
    return (
      <p className="p-6 text-sm text-text-muted">The queue could not be read from the server.</p>
    );
  }

  return (
    <DataTable
      label="Background jobs"
      columns={columns}
      rows={rows}
      emptyMessage="Nothing queued."
      growsOnScroll
      {...(pageSize === undefined ? {} : { pageSize })}
    />
  );
};

BackgroundJobs.displayName = 'BackgroundJobs';

export { BackgroundJobs };
